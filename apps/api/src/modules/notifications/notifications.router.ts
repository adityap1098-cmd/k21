import { Router } from 'express'
import { authenticate } from '../../middleware/authenticate.js'
import { listNotifications, getUnreadCount, markAsRead, markAllAsRead } from './notifications.service.js'

export const notificationsRouter = Router()

// GET /notifications — list user's notifications
notificationsRouter.get(
  '/',
  authenticate,
  async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 20, 50)
      const items = await listNotifications(req.user!.sub, limit)
      const unreadCount = await getUnreadCount(req.user!.sub)
      res.json({ success: true, data: { items, unreadCount }, error: null })
    } catch (err) {
      console.error('[notifications] GET / failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
)

// GET /notifications/unread-count — just the count (for badge polling)
notificationsRouter.get(
  '/unread-count',
  authenticate,
  async (req, res) => {
    try {
      const count = await getUnreadCount(req.user!.sub)
      res.json({ success: true, data: { count }, error: null })
    } catch (err) {
      console.error('[notifications] GET /unread-count failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
)

// POST /notifications/:id/read — mark one as read
notificationsRouter.post(
  '/:id/read',
  authenticate,
  async (req, res) => {
    try {
      await markAsRead(req.user!.sub, req.params.id)
      res.json({ success: true, data: null, error: null })
    } catch (err) {
      console.error('[notifications] POST /:id/read failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
)

// POST /notifications/read-all — mark all as read
notificationsRouter.post(
  '/read-all',
  authenticate,
  async (req, res) => {
    try {
      await markAllAsRead(req.user!.sub)
      res.json({ success: true, data: null, error: null })
    } catch (err) {
      console.error('[notifications] POST /read-all failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
)
