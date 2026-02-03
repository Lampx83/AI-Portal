"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { User, Target, Plus, X } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getProfile, getFaculties, patchProfile, type UserProfile, type Faculty } from "@/lib/api/users"

const ACADEMIC_TITLE_OPTIONS = [
  "",
  "Giảng viên",
  "Phó Giáo sư",
  "Giáo sư",
]

const ACADEMIC_DEGREE_OPTIONS = [
  "",
  "Sinh viên",
  "Cử nhân",
  "Thạc sĩ",
  "Tiến sĩ",
  "Nghiên cứu sinh",
]

export function ProfileSettingsView() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [faculties, setFaculties] = useState<Faculty[]>([])
  const [position, setPosition] = useState("")
  const [facultyId, setFacultyId] = useState<string>("")
  const [intro, setIntro] = useState("")
  const [researchDirection, setResearchDirection] = useState<string[]>([])
  const [newInterest, setNewInterest] = useState("")

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [profileRes, facultiesList] = await Promise.all([getProfile(), getFaculties()])
      setProfile(profileRes.profile)
      setFaculties(facultiesList)
      setAcademicTitle(profileRes.profile.academic_title ?? "")
      setAcademicDegree(profileRes.profile.academic_degree ?? "")
      setFacultyId(profileRes.profile.faculty_id ?? "")
      setIntro(profileRes.profile.intro ?? "")
      setResearchDirection(Array.isArray(profileRes.profile.research_direction) ? profileRes.profile.research_direction : [])
    } catch (e) {
      setError((e as Error)?.message ?? "Không tải được hồ sơ")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const addResearchInterest = () => {
    if (newInterest.trim() && !researchDirection.includes(newInterest.trim())) {
      setResearchDirection([...researchDirection, newInterest.trim()])
      setNewInterest("")
    }
  }

  const removeResearchInterest = (interest: string) => {
    setResearchDirection(researchDirection.filter((item) => item !== interest))
  }

  const onSave = async () => {
    if (!profile) return
    setSaving(true)
    setError(null)
    try {
      const body: { position?: string | null; faculty_id?: string | null; intro?: string | null; research_direction?: string[] | null; full_name?: string | null } = {
        position: position.trim() || null,
        faculty_id: facultyId || null,
        intro: intro.trim() || null,
        research_direction: researchDirection.length ? researchDirection : null,
      }
      if (!isSSO && profile.full_name !== undefined) body.full_name = profile.full_name?.trim() || null
      const res = await patchProfile(body)
      setProfile(res.profile)
      setAcademicTitle(res.profile.academic_title ?? "")
      setAcademicDegree(res.profile.academic_degree ?? "")
      setFacultyId(res.profile.faculty_id ?? "")
      setIntro(res.profile.intro ?? "")
      setResearchDirection(Array.isArray(res.profile.research_direction) ? res.profile.research_direction : [])
    } catch (e) {
      setError((e as Error)?.message ?? "Lưu thất bại")
    } finally {
      setSaving(false)
    }
  }

  const isSSO = !!profile?.sso_provider

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <p className="text-muted-foreground text-center py-8">Đang tải hồ sơ...</p>
      </div>
    )
  }

  if (error && !profile) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-4 text-red-800 dark:text-red-200">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-8">
          <Avatar className="w-20 h-20">
            {profile?.sso_provider && (session?.user as { image?: string | null })?.image ? (
              <AvatarImage src={(session?.user as { image?: string | null }).image ?? undefined} alt="Avatar" />
            ) : (
              <AvatarImage src="/placeholder-avatar.jpg" />
            )}
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

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-3 text-red-800 dark:text-red-200 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-6">
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
                    value={profile?.full_name ?? ""}
                    onChange={(e) => profile && !isSSO && setProfile({ ...profile, full_name: e.target.value })}
                    placeholder="Họ và tên"
                    readOnly={isSSO}
                    disabled={isSSO}
                    className={isSSO ? "bg-muted" : ""}
                  />
                  {isSSO && (
                    <p className="text-xs text-muted-foreground">Tên lấy từ đăng nhập SSO, không chỉnh sửa được.</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="position">Chức vụ</Label>
                  <Select value={position} onValueChange={setPosition}>
                    <SelectTrigger id="position">
                      <SelectValue placeholder="Chọn chức vụ" />
                    </SelectTrigger>
                    <SelectContent>
                      {POSITION_OPTIONS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="department">Khoa/Viện</Label>
                  <Select value={facultyId} onValueChange={setFacultyId}>
                    <SelectTrigger id="department">
                      <SelectValue placeholder="Chọn khoa/viện" />
                    </SelectTrigger>
                    <SelectContent>
                      {faculties.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bio">Giới thiệu</Label>
                <Textarea
                  id="bio"
                  value={intro}
                  onChange={(e) => setIntro(e.target.value)}
                  placeholder="Mô tả ngắn về bản thân và nghiên cứu..."
                />
              </div>
            </CardContent>
          </Card>

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
                {researchDirection.map((interest, index) => {
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
              {researchDirection.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">Chưa có lĩnh vực nghiên cứu nào được khai báo</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button className="bg-neu-blue hover:bg-neu-blue/90" onClick={onSave} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </div>
      </div>
    </div>
  )
}
