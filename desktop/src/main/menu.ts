import { Menu, type MenuItemConstructorOptions } from "electron"
import { tr, type StringKey } from "./i18n"

export interface MenuState {
  locale: "vi" | "en"
  isMac: boolean
  isDev: boolean
  /** Dự án đang mở trong cửa sổ hiện tại (null nếu không ở trang dự án). */
  hasActiveProject: boolean
  activeProjectLinked: boolean
  currentServer: string
  serverPresets: { label: string; url: string }[]
}

export interface MenuActions {
  goHome(): void
  linkFolder(): void
  revealFolder(): void
  switchServer(url: string): void
  customServer(): void
  setLocale(l: "vi" | "en"): void
  back(): void
  forward(): void
  reload(): void
  forceReload(): void
  zoom(delta: number | "reset"): void
  toggleDevTools(): void
  openGuide(): void
  openWebsite(): void
  about(): void
}

export function buildMenu(s: MenuState, a: MenuActions): Menu {
  const t = (k: StringKey) => tr(s.locale, k)
  const template: MenuItemConstructorOptions[] = []

  if (s.isMac) {
    template.push({
      label: t("appName"),
      submenu: [
        { label: t("about"), click: a.about },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit", label: `${t("quit")} ${t("appName")}` },
      ],
    })
  }

  template.push({
    label: t("file"),
    submenu: [
      { label: t("home"), accelerator: "CmdOrCtrl+Shift+H", click: a.goHome },
      { type: "separator" },
      { label: t("linkFolder"), accelerator: "CmdOrCtrl+O", click: a.linkFolder },
      {
        label: s.isMac ? t("revealFolder") : t("revealFolderWin"),
        accelerator: "CmdOrCtrl+Shift+O",
        enabled: s.activeProjectLinked,
        click: a.revealFolder,
      },
      { type: "separator" },
      {
        label: t("server"),
        submenu: [
          ...s.serverPresets.map(
            (p): MenuItemConstructorOptions => ({
              label: p.label,
              type: "radio",
              checked: p.url === s.currentServer,
              click: () => a.switchServer(p.url),
            }),
          ),
          { type: "separator" },
          { label: t("serverCustom"), click: a.customServer },
        ],
      },
      {
        label: t("menuLanguage"),
        submenu: [
          { label: "Tiếng Việt", type: "radio", checked: s.locale === "vi", click: () => a.setLocale("vi") },
          { label: "English", type: "radio", checked: s.locale === "en", click: () => a.setLocale("en") },
        ],
      },
      { type: "separator" },
      s.isMac ? { role: "close", label: t("close") } : { role: "quit", label: t("quit") },
    ],
  })

  template.push({
    label: t("edit"),
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "pasteAndMatchStyle" },
      { role: "selectAll" },
    ],
  })

  template.push({
    label: t("view"),
    submenu: [
      { label: t("back"), accelerator: "CmdOrCtrl+[", click: a.back },
      { label: t("forward"), accelerator: "CmdOrCtrl+]", click: a.forward },
      { type: "separator" },
      { label: t("reload"), accelerator: "CmdOrCtrl+R", click: a.reload },
      { label: t("forceReload"), accelerator: "CmdOrCtrl+Shift+R", click: a.forceReload },
      { type: "separator" },
      { label: t("resetZoom"), accelerator: "CmdOrCtrl+0", click: () => a.zoom("reset") },
      { label: t("zoomIn"), accelerator: "CmdOrCtrl+=", click: () => a.zoom(0.5) },
      // Phím tắt phụ (ẩn) cho bàn phím cần Shift để gõ "+".
      { label: t("zoomIn"), accelerator: "CmdOrCtrl+Plus", visible: false, acceleratorWorksWhenHidden: true, click: () => a.zoom(0.5) },
      { label: t("zoomOut"), accelerator: "CmdOrCtrl+-", click: () => a.zoom(-0.5) },
      { type: "separator" },
      { role: "togglefullscreen", label: t("fullscreen") },
      ...(s.isDev
        ? ([{ type: "separator" }, { label: t("devtools"), accelerator: "Alt+CmdOrCtrl+I", click: a.toggleDevTools }] as MenuItemConstructorOptions[])
        : []),
    ],
  })

  template.push({ label: t("window"), role: "windowMenu" })

  template.push({
    label: t("help"),
    role: "help",
    submenu: [
      { label: t("guide"), click: a.openGuide },
      { label: t("website"), click: a.openWebsite },
      { type: "separator" },
      { label: t("about"), click: a.about },
    ],
  })

  return Menu.buildFromTemplate(template)
}
