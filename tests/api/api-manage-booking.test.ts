import { describe, it, beforeAll, expect } from "bun:test";
import { getTestEnvironment } from "./helpers/environment";


describe("API: /api/manage-booking", () => {
  let userEmail: string;
  let authToken: string;
  let cfToken: string;
  let apiEndpoint: string;

  const testRoomName = `test-room-${Date.now()}`;

  beforeAll(async () => {
    const {
      TEST_AUTH_TOKEN,
      CF_WEBHOOK_SECRET,
      TEST_API_ENDPOINT,
      TEST_USER_1_EMAIL
    } = getTestEnvironment();

    userEmail = TEST_USER_1_EMAIL;
    authToken = TEST_AUTH_TOKEN;
    cfToken = CF_WEBHOOK_SECRET;
    apiEndpoint = TEST_API_ENDPOINT + '/api/manage-booking';
  });

  // Invalid GET requests
  it("should return 401 for missing auth header in GET", async () => {
    const response = await fetch(apiEndpoint, {
      method: 'GET',
    });

    expect(response.status).toBe(401);
  });

  it("should return 401 for invalid auth header in GET", async () => {
    const response = await fetch(apiEndpoint, {
      method: 'GET',
      headers: {
        Authorization: "Bearer invalid-token",
      }
    });

    expect(response.status).toBe(401);
  });

  it("should return 400 for missing room parameter in GET", async () => {
    const urlWithParams = new URL(apiEndpoint);
    urlWithParams.searchParams.set('email', userEmail);

    const response = await fetch(urlWithParams, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${cfToken}`,
      },
    });

    expect(response.status).toBe(400);
  });

  it("should return 400 for missing email parameter in GET", async () => {
    const urlWithParams = new URL(apiEndpoint);
    urlWithParams.searchParams.set('room', testRoomName);

    const response = await fetch(urlWithParams, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${cfToken}`,
      }
    });

    expect(response.status).toBe(400);
  });

  // Invalid POST requests
  it("should return 401 for missing auth header in POST", async () => {
    const response = await fetch(apiEndpoint, {
      method: 'POST',
    });

    expect(response.status).toBe(401);
  });

  it("should return 401 for invalid auth header in POST", async () => {
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        Authorization: "Bearer invalid-token",
      }
    });

    expect(response.status).toBe(401);
  });

  it("should return 400 for missing roomName in POST", async () => {
    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        password: "test123",
        lobby: false,
        maxOccupants: 50
      }),
    });

    expect(response.status).toBe(400);
  });

  it("should return 400 for invalid JSON in POST", async () => {
    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: "invalid json",
    });

    expect(response.status).toBe(400);
  });

  // Invalid DELETE requests
  it("should return 401 for missing auth header in DELETE", async () => {
    const response = await fetch(apiEndpoint, {
      method: 'DELETE',
    });

    expect(response.status).toBe(401);
  });

  it("should return 401 for invalid auth header in DELETE", async () => {
    const response = await fetch(apiEndpoint, {
      method: 'DELETE',
      headers: {
        Authorization: "Bearer invalid-token",
      }
    });

    expect(response.status).toBe(401);
  });

  it("should return 400 for missing roomName in DELETE", async () => {
    const response = await fetch(apiEndpoint, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
  });

  it("should return 400 for invalid JSON in DELETE", async () => {
    const response = await fetch(apiEndpoint, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: "invalid json",
    });

    expect(response.status).toBe(400);
  });

  // Expected behaviour tests
  it("should return 200 with default room settings for unbooked room", async () => {
    const urlWithParams = new URL(apiEndpoint);
    urlWithParams.searchParams.set('email', userEmail);
    urlWithParams.searchParams.set('room', testRoomName);

    const response = await fetch(urlWithParams, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${cfToken}`,
      },
    });

    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty("max_occupants", 100);
    expect(data).toHaveProperty("lobby", false);
    expect(data).toHaveProperty("password", "");
  });

  it("should create booking with valid request", async () => {
    // First, ensure we have a free slot by deleting all existing bookings for this user
    // This ensures the test can run even if a previous test run left bookings
    try {
      const dbUserEndpoint = apiEndpoint.replace('/manage-booking', '/db-user');
      const userResponse = await fetch(dbUserEndpoint, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      
      if (userResponse.ok) {
        const userData = await userResponse.json() as { bookedRooms: Array<{ roomName: string }> };
        // Delete all existing bookings to free up slots
        for (const booking of userData.bookedRooms || []) {
          try {
            await fetch(apiEndpoint, {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${authToken}`,
              },
              body: JSON.stringify({
                roomName: booking.roomName
              }),
            });
          } catch (e) {
            // Ignore individual delete errors
          }
        }
      }
    } catch (e) {
      // Ignore errors during cleanup
    }
    
    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        roomName: testRoomName,
        password: "test123",
        lobby: false,
        maxOccupants: 50,
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
      }),
    });

    // Should return 201 for successful booking creation
    expect(response.status).toBe(201);

    const data = await response.json();
    expect(data).toHaveProperty("id");
    expect(data).toHaveProperty("roomName");
    expect(data).toHaveProperty("userId");
    expect(data).toHaveProperty("lobbyEnabled");
    expect(data).toHaveProperty("meetingPassword");
    expect(data).toHaveProperty("maxOccupants");
    expect(data).toHaveProperty("endDate");
    expect(data).toHaveProperty("createdAt");
    expect(data).toHaveProperty("updatedAt");
  });

  it("should fail to create booking when no free slots", async () => {
    // This test assumes the user already has maxBookings bookings
    // Use a different room name to avoid conflicts
    const noSlotsRoomName = `no-slots-room-${Date.now()}`;
    
    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        roomName: noSlotsRoomName,
        password: "test123",
        lobby: false,
        maxOccupants: 50,
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
      }),
    });

    expect(response.status).toBe(403);
  });

  // TODO should fail to create booking with existing room
  // try create booking for same room by different user

  it("should successfully get valid booking", async () => {
    const urlWithParams = new URL(apiEndpoint);
    urlWithParams.searchParams.set('email', userEmail);
    urlWithParams.searchParams.set('room', testRoomName);

    const response = await fetch(urlWithParams, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${cfToken}`,
      },
    });

    expect(response.status).toBe(200);

    // TODO verify the returned response
  });

  it("should delete booking with valid request", async () => {
    const response = await fetch(apiEndpoint, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        roomName: testRoomName
      }),
    });

    expect(response.status).toBe(200);

    // TODO verify the response (if there is one)
  });

  it("should fail to delete non-existent booking", async () => {
    const response = await fetch(apiEndpoint, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        roomName: testRoomName
      }),
    });

    expect(response.status).toBe(404);
  });
});
