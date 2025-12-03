"use client"

import * as React from "react"
import { format } from "date-fns"
import {
  Video,
  FileText,
  MessageSquare,
  Download,
  Users,
  ClipboardList,
  FileIcon,
  ImageIcon,
  Sparkles,
} from "lucide-react"

import type { MeetingMetaData } from "@/data/sample-meetings"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"

interface MeetingDetailsProps {
  meeting: MeetingMetaData
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

export function MeetingDetails({ meeting }: MeetingDetailsProps) {
  // Collect all downloadable files
  const downloadableFiles: Array<{
    id: string
    name: string
    type: string
    size: number
    icon: React.ReactNode
    url: string
  }> = []

  // Add recordings
  meeting.recordings.forEach((recording) => {
    downloadableFiles.push({
      id: recording.id,
      name: `Recording (${recording.type})`,
      type: recording.type === "video" ? "video/mp4" : "audio/mp3",
      size: recording.size,
      icon: <Video className="h-5 w-5 text-blue-500" />,
      url: recording.url,
    })
  })

  // Add transcript
  if (meeting.transcript) {
    downloadableFiles.push({
      id: meeting.transcript.id,
      name: "Transcript",
      type: "text/plain",
      size: meeting.transcript.wordCount * 5, // Rough estimate
      icon: <FileText className="h-5 w-5 text-green-500" />,
      url: meeting.transcript.url,
    })
  }

  // Add AI summary
  if (meeting.aiSummary) {
    downloadableFiles.push({
      id: `ai-summary-${meeting.id}`,
      name: "AI Summary",
      type: "text/plain",
      size: meeting.aiSummary.length,
      icon: <Sparkles className="h-5 w-5 text-yellow-500" />,
      url: "#",
    })
  }

  // Add shared files
  meeting.sharedFiles.forEach((file) => {
    downloadableFiles.push({
      id: file.id,
      name: file.name,
      type: file.type,
      size: file.size,
      icon: <FileIcon className="h-5 w-5 text-muted-foreground" />,
      url: file.url,
    })
  })

  // Add whiteboard
  if (meeting.whiteboard) {
    downloadableFiles.push({
      id: meeting.whiteboard.id,
      name: meeting.whiteboard.name,
      type: "image/png",
      size: 0, // Unknown size
      icon: <ImageIcon className="h-5 w-5 text-purple-500" />,
      url: meeting.whiteboard.url,
    })
  }

  // Add meeting logs (chat log as file)
  if (meeting.chatLog.length > 0) {
    downloadableFiles.push({
      id: `chat-log-${meeting.id}`,
      name: "Chat Log",
      type: "text/plain",
      size: meeting.chatLog.reduce((acc, msg) => acc + msg.message.length, 0),
      icon: <MessageSquare className="h-5 w-5 text-indigo-500" />,
      url: "#",
    })
  }

  return (
    <div className="p-6 bg-muted/30">
      <Tabs defaultValue="files" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        {/* Files Tab */}
        <TabsContent value="files" className="space-y-4">
          {downloadableFiles.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <FileIcon className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No files available for this meeting</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {downloadableFiles.map((file) => (
                <Card key={file.id}>
                  <CardContent className="flex items-center p-4 gap-4">
                    <div className="flex-shrink-0">{file.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {file.type}
                        {file.size > 0 && ` • ${formatBytes(file.size)}`}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="gap-2">
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Participants */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Participants ({meeting.attendance.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {meeting.attendance.map((attendee, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {attendee.participantName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {attendee.participantName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {attendee.participantEmail}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {attendee.role}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {attendee.duration} min
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Chat Log */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Chat Log ({meeting.chatLog.length} messages)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {meeting.chatLog.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No chat messages
                  </p>
                ) : (
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-3">
                      {meeting.chatLog.map((message) => (
                        <div key={message.id} className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium">{message.sender}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(message.timestamp), "h:mm a")}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground pl-0">
                            {message.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Polls */}
            {meeting.polls.length > 0 && (
              <Card className="md:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Polls ({meeting.polls.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {meeting.polls.map((poll) => (
                      <div key={poll.id} className="space-y-2">
                        <p className="text-sm font-medium">{poll.question}</p>
                        <div className="space-y-1">
                          {poll.options.map((option, i) => {
                            const percentage = Math.round((option.votes / poll.totalVotes) * 100)
                            return (
                              <div key={i} className="relative">
                                <div
                                  className="absolute inset-0 bg-primary/10 rounded"
                                  style={{ width: `${percentage}%` }}
                                />
                                <div className="relative flex justify-between px-2 py-1 text-xs">
                                  <span>{option.text}</span>
                                  <span className="font-medium">{percentage}% ({option.votes} votes)</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {poll.totalVotes} total votes
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
