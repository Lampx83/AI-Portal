"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Settings, Palette, Bell, Shield, Database, Zap } from "lucide-react"

export function SystemSettingsView() {
  const [settings, setSettings] = useState({
    language: "vi",
    theme: "system",
    notifications: {
      email: true,
      push: true,
      research: true,
      publications: false,
    },
    privacy: {
      profileVisible: true,
      researchVisible: false,
      publicationsVisible: true,
    },
    ai: {
      personalization: true,
      autoSuggestions: true,
      responseLength: [2],
      creativity: [3],
    },
    data: {
      autoBackup: true,
      syncEnabled: true,
      cacheSize: [1],
    },
  })

  const updateSetting = (category: string, key: string, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [category]: {
        ...prev[category as keyof typeof prev],
        [key]: value,
      },
    }))
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto h-full">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Settings className="w-6 h-6" />
            Cài đặt hệ thống
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Tùy chỉnh trải nghiệm sử dụng NEU Research</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Giao diện */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Giao diện
              </CardTitle>
              <CardDescription>Tùy chỉnh ngôn ngữ và giao diện</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Ngôn ngữ</Label>
                <Select value={settings.language} onValueChange={(value) => updateSetting("", "language", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vi">Tiếng Việt</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Chủ đề</Label>
                <Select value={settings.theme} onValueChange={(value) => updateSetting("", "theme", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Sáng</SelectItem>
                    <SelectItem value="dark">Tối</SelectItem>
                    <SelectItem value="system">Theo hệ thống</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Thông báo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Thông báo
              </CardTitle>
              <CardDescription>Quản lý các loại thông báo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="email-notifications">Thông báo email</Label>
                <Switch
                  id="email-notifications"
                  checked={settings.notifications.email}
                  onCheckedChange={(checked) => updateSetting("notifications", "email", checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="push-notifications">Thông báo đẩy</Label>
                <Switch
                  id="push-notifications"
                  checked={settings.notifications.push}
                  onCheckedChange={(checked) => updateSetting("notifications", "push", checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="research-notifications">Cập nhật nghiên cứu</Label>
                <Switch
                  id="research-notifications"
                  checked={settings.notifications.research}
                  onCheckedChange={(checked) => updateSetting("notifications", "research", checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="publication-notifications">Cơ hội công bố</Label>
                <Switch
                  id="publication-notifications"
                  checked={settings.notifications.publications}
                  onCheckedChange={(checked) => updateSetting("notifications", "publications", checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Quyền riêng tư */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Quyền riêng tư
              </CardTitle>
              <CardDescription>Kiểm soát thông tin hiển thị</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="profile-visible">Hồ sơ công khai</Label>
                <Switch
                  id="profile-visible"
                  checked={settings.privacy.profileVisible}
                  onCheckedChange={(checked) => updateSetting("privacy", "profileVisible", checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="research-visible">Nghiên cứu công khai</Label>
                <Switch
                  id="research-visible"
                  checked={settings.privacy.researchVisible}
                  onCheckedChange={(checked) => updateSetting("privacy", "researchVisible", checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="publications-visible">Công bố công khai</Label>
                <Switch
                  id="publications-visible"
                  checked={settings.privacy.publicationsVisible}
                  onCheckedChange={(checked) => updateSetting("privacy", "publicationsVisible", checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Cài đặt AI */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Trợ lý AI
              </CardTitle>
              <CardDescription>Tùy chỉnh hành vi của AI</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="personalization">Cá nhân hóa</Label>
                <Switch
                  id="personalization"
                  checked={settings.ai.personalization}
                  onCheckedChange={(checked) => updateSetting("ai", "personalization", checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-suggestions">Gợi ý tự động</Label>
                <Switch
                  id="auto-suggestions"
                  checked={settings.ai.autoSuggestions}
                  onCheckedChange={(checked) => updateSetting("ai", "autoSuggestions", checked)}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Độ dài phản hồi:{" "}
                  {settings.ai.responseLength[0] === 1
                    ? "Ngắn"
                    : settings.ai.responseLength[0] === 2
                      ? "Trung bình"
                      : "Dài"}
                </Label>
                <Slider
                  value={settings.ai.responseLength}
                  onValueChange={(value) => updateSetting("ai", "responseLength", value)}
                  max={3}
                  min={1}
                  step={1}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label>Độ sáng tạo: {settings.ai.creativity[0]}/5</Label>
                <Slider
                  value={settings.ai.creativity}
                  onValueChange={(value) => updateSetting("ai", "creativity", value)}
                  max={5}
                  min={1}
                  step={1}
                  className="w-full"
                />
              </div>
            </CardContent>
          </Card>

          {/* Dữ liệu */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Dữ liệu
              </CardTitle>
              <CardDescription>Quản lý lưu trữ và đồng bộ</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-backup">Sao lưu tự động</Label>
                <Switch
                  id="auto-backup"
                  checked={settings.data.autoBackup}
                  onCheckedChange={(checked) => updateSetting("data", "autoBackup", checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="sync-enabled">Đồng bộ đám mây</Label>
                <Switch
                  id="sync-enabled"
                  checked={settings.data.syncEnabled}
                  onCheckedChange={(checked) => updateSetting("data", "syncEnabled", checked)}
                />
              </div>
              <div className="space-y-2">
                <Label>Kích thước cache: {settings.data.cacheSize[0]} GB</Label>
                <Slider
                  value={settings.data.cacheSize}
                  onValueChange={(value) => updateSetting("data", "cacheSize", value)}
                  max={5}
                  min={1}
                  step={1}
                  className="w-full"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  Xóa cache
                </Button>
                <Button variant="outline" size="sm">
                  Xuất dữ liệu
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end pt-6">
          <Button className="bg-neu-blue hover:bg-neu-blue/90">Lưu cài đặt</Button>
        </div>
      </div>
    </div>
  )
}
