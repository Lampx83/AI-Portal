"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { User, KeyRound, Bell, Code, History, Copy, Trash2 } from "lucide-react"

const activityLog = [
  { activity: "Đăng nhập thành công", time: "2025-07-04 10:55:18", ip: "113.161.45.12" },
  { activity: "Tạo nghiên cứu mới: Phân tích thị trường BĐS", time: "2025-07-03 14:20:01", ip: "113.161.45.12" },
  { activity: "Sử dụng trợ lý Chuyên gia", time: "2025-07-03 11:05:30", ip: "113.161.45.12" },
  { activity: "Đổi mật khẩu", time: "2025-07-01 09:00:00", ip: "203.0.113.25" },
]

export function ProfileView() {
  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto bg-gray-50 dark:bg-gray-950">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Hồ sơ của tôi</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Quản lý thông tin cá nhân, bảo mật và các cài đặt liên quan đến tài khoản của bạn.
          </p>
        </header>

        <Tabs defaultValue="personal-info" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 mb-6 h-auto">
            <TabsTrigger value="personal-info" className="py-2">
              <User className="w-4 h-4 mr-2" />
              Thông tin
            </TabsTrigger>
            <TabsTrigger value="change-password" className="py-2">
              <KeyRound className="w-4 h-4 mr-2" />
              Mật khẩu
            </TabsTrigger>
            <TabsTrigger value="notifications" className="py-2">
              <Bell className="w-4 h-4 mr-2" />
              Thông báo
            </TabsTrigger>
            <TabsTrigger value="api-keys" className="py-2">
              <Code className="w-4 h-4 mr-2" />
              API Keys
            </TabsTrigger>
            <TabsTrigger value="activity" className="py-2">
              <History className="w-4 h-4 mr-2" />
              Hoạt động
            </TabsTrigger>
          </TabsList>

          <TabsContent value="personal-info">
            <Card>
              <CardHeader>
                <CardTitle>Thông tin cá nhân</CardTitle>
                <CardDescription>Cập nhật thông tin hiển thị và liên lạc của bạn.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Tên hiển thị</Label>
                  <Input id="displayName" defaultValue="nguyenvana" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" defaultValue="nva@st.neu.edu.vn" disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Chức danh</Label>
                  <Input id="title" defaultValue="Nghiên cứu sinh" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Đơn vị công tác</Label>
                  <Input id="department" defaultValue="Viện Kinh tế học" />
                </div>
              </CardContent>
              <CardFooter>
                <Button>Lưu thay đổi</Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="change-password">
            <Card>
              <CardHeader>
                <CardTitle>Đổi mật khẩu</CardTitle>
                <CardDescription>Để bảo mật, hãy chọn một mật khẩu mạnh và duy nhất.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Mật khẩu cũ</Label>
                  <Input id="current-password" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Mật khẩu mới</Label>
                  <Input id="new-password" type="password" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Xác nhận mật khẩu mới</Label>
                  <Input id="confirm-password" type="password" />
                </div>
              </CardContent>
              <CardFooter>
                <Button>Đổi mật khẩu</Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Cài đặt thông báo</CardTitle>
                <CardDescription>Chọn cách bạn muốn nhận thông báo từ hệ thống.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between space-x-2 p-4 rounded-lg border">
                  <Label htmlFor="email-notifications" className="flex flex-col space-y-1 cursor-pointer">
                    <span>Thông báo qua Email</span>
                    <span className="font-normal leading-snug text-muted-foreground">
                      Nhận thông báo quan trọng và cập nhật qua email đã đăng ký.
                    </span>
                  </Label>
                  <Switch id="email-notifications" defaultChecked />
                </div>
                <div className="flex items-center justify-between space-x-2 p-4 rounded-lg border">
                  <Label htmlFor="conference-alerts" className="flex flex-col space-y-1 cursor-pointer">
                    <span>Thông báo hội thảo mới</span>
                    <span className="font-normal leading-snug text-muted-foreground">
                      Gửi thông báo khi có hội thảo, tạp chí phù hợp với lĩnh vực của bạn.
                    </span>
                  </Label>
                  <Switch id="conference-alerts" defaultChecked />
                </div>
                <div className="flex items-center justify-between space-x-2 p-4 rounded-lg border">
                  <Label htmlFor="system-updates" className="flex flex-col space-y-1 cursor-pointer">
                    <span>Cập nhật hệ thống</span>
                    <span className="font-normal leading-snug text-muted-foreground">
                      Thông báo về các tính năng mới và bảo trì hệ thống.
                    </span>
                  </Label>
                  <Switch id="system-updates" />
                </div>
              </CardContent>
              <CardFooter>
                <Button>Lưu cài đặt</Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="api-keys">
            <Card>
              <CardHeader>
                <CardTitle>Quản lý API Key</CardTitle>
                <CardDescription>Sử dụng API key để tích hợp NEU Research với các ứng dụng khác.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-end">
                  <Button>Tạo API Key mới</Button>
                </div>
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Key cho ứng dụng di động</p>
                      <p className="text-sm text-muted-foreground">neu_sk_...a1b2</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon">
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle>Hoạt động tài khoản</CardTitle>
                <CardDescription>Nhật ký các hoạt động gần đây trên tài khoản của bạn.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hoạt động</TableHead>
                      <TableHead>Thời gian</TableHead>
                      <TableHead>Địa chỉ IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activityLog.map((log, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{log.activity}</TableCell>
                        <TableCell>{log.time}</TableCell>
                        <TableCell>{log.ip}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
