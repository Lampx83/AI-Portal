"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { User, Target, Plus, X } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function ProfileSettingsView() {
  const [profile, setProfile] = useState({
    name: "Nguyễn Văn A",
    position: "Nghiên cứu sinh",
    department: "Khoa Kinh tế",
    bio: "Nghiên cứu sinh chuyên về kinh tế vĩ mô và chính sách tiền tệ.",
  })

  const [researchInterests, setResearchInterests] = useState([
    "Kinh tế vĩ mô",
    "Chính sách tiền tệ",
    "Lạm phát",
    "Tăng trưởng kinh tế",
    "Kinh tế lượng",
  ])

  const [newInterest, setNewInterest] = useState("")

  const addResearchInterest = () => {
    if (newInterest.trim() && !researchInterests.includes(newInterest.trim())) {
      setResearchInterests([...researchInterests, newInterest.trim()])
      setNewInterest("")
    }
  }

  const removeResearchInterest = (interest: string) => {
    setResearchInterests(researchInterests.filter((item) => item !== interest))
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-8">
          <Avatar className="w-20 h-20">
            <AvatarImage src="/placeholder-avatar.jpg" />
            <AvatarFallback className="text-2xl">
              <User className="w-10 h-10" />
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Hồ sơ cá nhân</h1>
            <p className="text-gray-500 dark:text-gray-400">
              Cập nhật thông tin để AI có thể cá nhân hóa trải nghiệm của bạn
            </p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Thông tin cá nhân */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Thông tin cá nhân
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Họ và tên</Label>
                  <Input
                    id="name"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="position">Chức vụ</Label>
                  <Select
                    value={profile.position}
                    onValueChange={(value) => setProfile({ ...profile, position: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn chức vụ" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Sinh viên">Sinh viên</SelectItem>
                      <SelectItem value="Nghiên cứu sinh">Nghiên cứu sinh</SelectItem>
                      <SelectItem value="Giảng viên">Giảng viên</SelectItem>
                      <SelectItem value="Tiến sĩ">Tiến sĩ</SelectItem>
                      <SelectItem value="Thạc sĩ">Thạc sĩ</SelectItem>
                      <SelectItem value="Giáo sư">Giáo sư</SelectItem>
                      <SelectItem value="Phó Giáo sư">Phó Giáo sư</SelectItem>
                      <SelectItem value="Nghiên cứu viên">Nghiên cứu viên</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="department">Khoa/Viện</Label>
                  <Select
                    value={profile.department}
                    onValueChange={(value) => setProfile({ ...profile, department: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn khoa/viện" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Khoa Kinh tế">Khoa Kinh tế</SelectItem>
                      <SelectItem value="Khoa Quản trị Kinh doanh">Khoa Quản trị Kinh doanh</SelectItem>
                      <SelectItem value="Khoa Tài chính - Ngân hàng">Khoa Tài chính - Ngân hàng</SelectItem>
                      <SelectItem value="Khoa Kế toán - Kiểm toán">Khoa Kế toán - Kiểm toán</SelectItem>
                      <SelectItem value="Khoa Thương mại">Khoa Thương mại</SelectItem>
                      <SelectItem value="Khoa Luật Kinh tế">Khoa Luật Kinh tế</SelectItem>
                      <SelectItem value="Khoa Quan hệ Quốc tế">Khoa Quan hệ Quốc tế</SelectItem>
                      <SelectItem value="Khoa Công nghệ Thông tin">Khoa Công nghệ Thông tin</SelectItem>
                      <SelectItem value="Viện Đào tạo Quốc tế">Viện Đào tạo Quốc tế</SelectItem>
                      <SelectItem value="Viện Nghiên cứu Kinh tế">Viện Nghiên cứu Kinh tế</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bio">Giới thiệu</Label>
                <Textarea
                  id="bio"
                  value={profile.bio}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                  placeholder="Mô tả ngắn về bản thân và nghiên cứu..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Định hướng nghiên cứu */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Định hướng nghiên cứu
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newInterest}
                  onChange={(e) => setNewInterest(e.target.value)}
                  placeholder="Thêm lĩnh vực nghiên cứu..."
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addResearchInterest())}
                />
                <Button onClick={addResearchInterest} size="icon" variant="outline">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {researchInterests.map((interest, index) => {
                  const colors = [
                    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
                    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
                    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
                    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
                    "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
                    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
                    "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
                    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
                  ]
                  const colorClass = colors[index % colors.length]

                  return (
                    <Badge key={index} className={`flex items-center gap-1 ${colorClass}`}>
                      {interest}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 hover:bg-black/10 dark:hover:bg-white/10"
                        onClick={() => removeResearchInterest(interest)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </Badge>
                  )
                })}
              </div>
              {researchInterests.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                  Chưa có lĩnh vực nghiên cứu nào được khai báo
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button className="bg-neu-blue hover:bg-neu-blue/90">Lưu thay đổi</Button>
        </div>
      </div>
    </div>
  )
}
