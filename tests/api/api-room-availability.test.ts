import { describe, it, beforeAll, expect } from "bun:test";
import { getTestEnvironment } from "./helpers/environment";

describe("API: /api/room-availability", () => {
  let userEmail: string;
  let authToken: string;
  let apiEndpoint: string;

  const testRoomName = `test-room-${Date.now()}`;
  const availableRoomName = `available-room-${Date.now()}`;

  beforeAll(async () => {
    const {
      TEST_AUTH_TOKEN,
      TEST_API_ENDPOINT,
      TEST_USER_1_EMAIL
    } = getTestEnvironment();

    userEmail = TEST_USER_1_EMAIL;
    authToken = TEST_AUTH_TOKEN;
    apiEndpoint = TEST_API_ENDPOINT + '/api/room-availability';
  });

  // Authentication tests
  it("should return 401 for missing authorization header", async () => {
    const urlWithParams = new URL(apiEndpoint);
    urlWithParams.searchParams.set('roomName', testRoomName);

    const response = await fetch(urlWithParams, {
      method: "GET",
    });

    expect(response.status).toBe(401);
    
    const data = await response.json();
    expect(data).toHaveProperty("error", "Missing Authorization header");
  });

  it("should return 401 for invalid authorization token", async () => {
    const urlWithParams = new URL(apiEndpoint);
    urlWithParams.searchParams.set('roomName', testRoomName);

    const response = await fetch(urlWithParams, {
      method: "GET",
      headers: {
        Authorization: "Bearer invalid-token",
      },
    });

    expect(response.status).toBe(401);
    
    const data = await response.json();
    expect(data).toHaveProperty("error", "Invalid token");
  });

  // Parameter validation tests
  it("should return 400 for missing roomName parameter", async () => {
    const response = await fetch(apiEndpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.status).toBe(400);
    
    const data = await response.json();
    expect(data).toHaveProperty("error", "Missing required parameter: roomName");
  });

  it("should return 400 for empty roomName parameter", async () => {
    const urlWithParams = new URL(apiEndpoint);
    urlWithParams.searchParams.set('roomName', '   '); // whitespace only

    const response = await fetch(urlWithParams, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.status).toBe(400);
    
    const data = await response.json();
    expect(data).toHaveProperty("error", "Invalid room name: cannot be empty");
  });

  it("should return 400 for completely empty roomName parameter", async () => {
    const urlWithParams = new URL(apiEndpoint);
    urlWithParams.searchParams.set('roomName', '');

    const response = await fetch(urlWithParams, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.status).toBe(400);
    
    const data = await response.json();
    expect(data).toHaveProperty("error", "Missing required parameter: roomName");
  });

  // Functionality tests
  it("should return available=true for unbooked room", async () => {
    const urlWithParams = new URL(apiEndpoint);
    urlWithParams.searchParams.set('roomName', availableRoomName);

    const response = await fetch(urlWithParams, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty("available", true);
    expect(data).toHaveProperty("roomName", availableRoomName);
  });

  it("should handle room names with special characters", async () => {
    const specialRoomName = "test-room_123.with-special@chars";
    const urlWithParams = new URL(apiEndpoint);
    urlWithParams.searchParams.set('roomName', specialRoomName);

    const response = await fetch(urlWithParams, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty("available", true);
    expect(data).toHaveProperty("roomName", specialRoomName);
  });

  it("should trim whitespace from room names", async () => {
    const roomNameWithSpaces = `  ${availableRoomName}  `;
    const urlWithParams = new URL(apiEndpoint);
    urlWithParams.searchParams.set('roomName', roomNameWithSpaces);

    const response = await fetch(urlWithParams, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty("available", true);
    expect(data).toHaveProperty("roomName", availableRoomName); // Should be trimmed
  });

  // Integration test with booking system
  it("should return available=false for booked room", async () => {
    // First, create a booking for the test room using the manage-booking API
    const manageBookingEndpoint = apiEndpoint.replace('/room-availability', '/manage-booking');
    
    // Ensure we have a free slot by deleting all existing bookings for this user
    try {
      const dbUserEndpoint = apiEndpoint.replace('/room-availability', '/db-user');
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
            await fetch(manageBookingEndpoint, {
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
    
    const bookingResponse = await fetch(manageBookingEndpoint, {
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

    // Verify booking was created successfully
    expect(bookingResponse.status).toBe(201);

    // Now check room availability
    const urlWithParams = new URL(apiEndpoint);
    urlWithParams.searchParams.set('roomName', testRoomName);

    const availabilityResponse = await fetch(urlWithParams, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect(availabilityResponse.status).toBe(200);
    
    const data = await availabilityResponse.json();
    expect(data).toHaveProperty("available", false);
    expect(data).toHaveProperty("roomName", testRoomName);

    // Clean up: delete the booking
    const deleteResponse = await fetch(manageBookingEndpoint, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        roomName: testRoomName
      }),
    });

    expect(deleteResponse.status).toBe(200);
  });

  it("should return available=true after room is unbooked", async () => {
    // Verify the room is now available again after deletion
    const urlWithParams = new URL(apiEndpoint);
    urlWithParams.searchParams.set('roomName', testRoomName);

    const response = await fetch(urlWithParams, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty("available", true);
    expect(data).toHaveProperty("roomName", testRoomName);
  });

  // Case sensitivity test
  it("should be case sensitive for room names", async () => {
    const lowerCaseRoom = "testroom123";
    const upperCaseRoom = "TESTROOM123";
    
    // Check both variations are available (assuming no bookings exist)
    const lowerResponse = await fetch(new URL(apiEndpoint + `?roomName=${lowerCaseRoom}`), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const upperResponse = await fetch(new URL(apiEndpoint + `?roomName=${upperCaseRoom}`), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    expect(lowerResponse.status).toBe(200);
    expect(upperResponse.status).toBe(200);
    
    const lowerData = await lowerResponse.json() as { available: boolean; roomName: string };
    const upperData = await upperResponse.json() as { available: boolean; roomName: string };
    
    expect(lowerData).toHaveProperty("available", true);
    expect(upperData).toHaveProperty("available", true);
    expect(lowerData.roomName).toBe(lowerCaseRoom);
    expect(upperData.roomName).toBe(upperCaseRoom);
  });
});
