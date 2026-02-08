/**
 * WebSocket server cho real-time collaborative editing (theo từng bài viết).
 * Kết nối: /ws?articleId=uuid hoặc /ws?shareToken=hex
 * Auth: cookie session (same-origin).
 */
import { WebSocketServer, WebSocket } from "ws"
import { IncomingMessage } from "http"
import { getCurrentUserFromWs, resolveArticleAccess } from "../routes/write-articles"

type ClientInfo = { ws: WebSocket; userId: string; userName: string }
const rooms = new Map<string, Set<ClientInfo>>()

function parseQuery(url: string): Record<string, string> {
  const i = url.indexOf("?")
  if (i === -1) return {}
  const params = new URLSearchParams(url.slice(i))
  return Object.fromEntries(params.entries())
}

function broadcastToOthers(articleId: string, excludeWs: WebSocket, payload: object) {
  const room = rooms.get(articleId)
  if (!room) return
  const raw = JSON.stringify(payload)
  room.forEach((c) => {
    if (c.ws !== excludeWs && c.ws.readyState === WebSocket.OPEN) c.ws.send(raw)
  })
}

function getPresenceList(articleId: string): { id: string; name: string }[] {
  const room = rooms.get(articleId)
  if (!room) return []
  return Array.from(room).map((c) => ({ id: c.userId, name: c.userName }))
}

function broadcastPresence(articleId: string) {
  const list = getPresenceList(articleId)
  const room = rooms.get(articleId)
  if (!room) return
  const payload = JSON.stringify({ type: "presence", users: list })
  room.forEach((c) => {
    if (c.ws.readyState === WebSocket.OPEN) c.ws.send(payload)
  })
}

export function attachCollabWs(server: import("http").Server): void {
  const wss = new WebSocketServer({ noServer: true })

  server.on("upgrade", (req: IncomingMessage, socket: import("stream").Duplex, head: Buffer) => {
    const url = req.url ?? ""
    if (!url.startsWith("/ws")) {
      socket.destroy()
      return
    }
    const query = parseQuery(url)
    const articleIdParam = query.articleId?.trim()
    const shareTokenParam = query.shareToken?.trim()
    if (!articleIdParam && !shareTokenParam) {
      socket.destroy()
      return
    }

    getCurrentUserFromWs(req as any)
      .then((user) => {
        if (!user) {
          socket.destroy()
          return
        }
        return resolveArticleAccess(user.id, user.email, {
          articleId: articleIdParam || undefined,
          shareToken: shareTokenParam || undefined,
        }).then((articleId) => {
          if (!articleId) {
            socket.destroy()
            return
          }
          wss.handleUpgrade(req, socket, head, (ws: WebSocket) => {
            wss.emit("connection", ws, req, { articleId, user })
          })
        })
      })
      .catch(() => socket.destroy())
  })

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage, ctx: { articleId: string; user: { id: string; email?: string; name?: string } }) => {
    const { articleId, user } = ctx
    const userName = (user.name || user.email || "Người dùng").slice(0, 100)
    const info: ClientInfo = { ws, userId: user.id, userName }
    if (!rooms.has(articleId)) rooms.set(articleId, new Set())
    rooms.get(articleId)!.add(info)
    broadcastPresence(articleId)

    ws.on("message", (data: Buffer | string) => {
      try {
        const msg = JSON.parse(data.toString())
        if (msg.type === "content" && msg.payload) {
          broadcastToOthers(articleId, ws, {
            type: "content",
            payload: msg.payload,
            from: { id: user.id, name: userName },
          })
        }
      } catch {
        // ignore invalid JSON
      }
    })

    ws.on("close", () => {
      const room = rooms.get(articleId)
      if (room) {
        room.delete(info)
        if (room.size === 0) rooms.delete(articleId)
        else broadcastPresence(articleId)
      }
    })

    ws.on("error", () => {
      const room = rooms.get(articleId)
      if (room) {
        room.delete(info)
        if (room.size === 0) rooms.delete(articleId)
        else broadcastPresence(articleId)
      }
    })
  })
}
