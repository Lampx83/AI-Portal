// routes/admin.ts
import { Router } from "express"
import { adminOnly } from "./admin/middleware"
import datalakeInboxRouter from "./datalake-inbox"
import dbRouter from "./admin/db"
import pluginsRouter from "./admin/plugins"
import qdrantRouter from "./admin/qdrant"
import notificationsRouter from "./admin/notifications"
import configRouter from "./admin/config"
import usersRouter from "./admin/users"
import siteStringsRouter from "./admin/site-strings"
import localePackagesRouter from "./admin/locale-packages"
import agentsRouter from "./admin/agents"
import toolsRouter from "./admin/tools"
import chatRouter from "./admin/chat"
import statsRouter from "./admin/stats"
import { feedbackRouter, messageFeedbackRouter } from "./admin/feedback"
import backupRouter from "./admin/backup"
import settingsRouter from "./admin/settings"
import pagesRouter from "./admin/pages"

const router = Router()

router.use(pluginsRouter)

// Sub-routers with path prefix
router.use("/datalake-inbox", adminOnly, datalakeInboxRouter)
router.use("/db", adminOnly, dbRouter)
router.use("/qdrant", adminOnly, qdrantRouter)
router.use("/notifications", adminOnly, notificationsRouter)

router.use(configRouter)

router.use("/users", adminOnly, usersRouter)
router.use("/site-strings", adminOnly, siteStringsRouter)
router.use("/locale-packages", adminOnly, localePackagesRouter)
router.use("/agents", adminOnly, agentsRouter)
router.use("/tools", adminOnly, toolsRouter)
router.use("/chat", adminOnly, chatRouter)
router.use("/stats", adminOnly, statsRouter)
router.use("/feedback", adminOnly, feedbackRouter)
router.use("/message-feedback", adminOnly, messageFeedbackRouter)
router.use("/backup", adminOnly, backupRouter)
router.use("/settings", adminOnly, settingsRouter)
router.use("/pages", adminOnly, pagesRouter)

export default router
