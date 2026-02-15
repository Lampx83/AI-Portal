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
import { getProfile, getDepartments, patchProfile, type UserProfile, type Department } from "@/lib/api/users"

type ProfileSettingsViewProps = { onSaveSuccess?: () => void }

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
  "Học viên sau đại học",
]

/** Giá trị sentinel cho "Chưa chọn" - Radix Select không cho phép value="" */
const POSITION_NONE = "__none__"

/** Các lựa chọn cho trường Trình độ (học hàm, học vị) */
const POSITION_OPTIONS: { value: string; label: string }[] = [
  { value: POSITION_NONE, label: "Chưa chọn" },
  { value: "Sinh viên", label: "Sinh viên" },
  { value: "Cử nhân", label: "Cử nhân" },
  { value: "Thạc sĩ", label: "Thạc sĩ" },
  { value: "Tiến sĩ", label: "Tiến sĩ" },
  { value: "Học viên sau đại học", label: "Học viên sau đại học" },
  { value: "Giảng viên", label: "Giảng viên" },
  { value: "Phó Giáo sư", label: "Phó Giáo sư" },
  { value: "Giáo sư", label: "Giáo sư" },
]

export function ProfileSettingsView({ onSaveSuccess }: ProfileSettingsViewProps) {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [position, setPosition] = useState("")
  const [departmentId, setDepartmentId] = useState<string>("")
  const [intro, setIntro] = useState("")
  const [directions, setDirections] = useState<string[]>([])
  const [newInterest, setNewInterest] = useState("")
  const [googleScholarUrl, setGoogleScholarUrl] = useState("")

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [profileRes, departmentsList] = await Promise.all([getProfile(), getDepartments()])
      setProfile(profileRes.profile)
      setDepartments(departmentsList)
      setPosition(profileRes.profile.position?.trim() || POSITION_NONE)
      setDepartmentId(profileRes.profile.department_id ?? "")
      setIntro(profileRes.profile.intro ?? "")
      setGoogleScholarUrl((profileRes.profile as { google_scholar_url?: string })?.google_scholar_url ?? "")
      setDirections(Array.isArray(profileRes.profile.direction) ? profileRes.profile.direction : [])
    } catch (e) {
      setError((e as Error)?.message ?? "Không tải được hồ sơ")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const addDirection = () => {
    if (newInterest.trim() && !directions.includes(newInterest.trim())) {
      setDirections([...directions, newInterest.trim()])
      setNewInterest("")
    }
  }

  const removeDirection = (interest: string) => {
    setDirections(directions.filter((item) => item !== interest))
  }

  const onSave = async () => {
    if (!profile) return
    setSaving(true)
    setError(null)
    try {
      const body: { position?: string | null; department_id?: string | null; intro?: string | null; direction?: string[] | null; full_name?: string | null; google_scholar_url?: string | null } = {
        position: (position === POSITION_NONE || !position?.trim()) ? null : position.trim(),
        department_id: departmentId || null,
        intro: intro.trim() || null,
        direction: directions.length ? directions : null,
        google_scholar_url: googleScholarUrl.trim() || null,
      }
      if (!isSSO && profile.full_name !== undefined) body.full_name = profile.full_name?.trim() || null
      const res = await patchProfile(body)
      setProfile(res.profile)
      setPosition(res.profile.position?.trim() || POSITION_NONE)
      setDepartmentId(res.profile.department_id ?? "")
      setIntro(res.profile.intro ?? "")
      setGoogleScholarUrl((res.profile as { google_scholar_url?: string })?.google_scholar_url ?? "")
      setDirections(Array.isArray(res.profile.direction) ? res.profile.direction : [])
      onSaveSuccess?.()
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
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="position">Trình độ</Label>
                  <Select value={position || POSITION_NONE} onValueChange={setPosition}>
                    <SelectTrigger id="position">
                      <SelectValue placeholder="Chọn trình độ" />
                    </SelectTrigger>
                    <SelectContent>
                      {POSITION_OPTIONS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="department">Đơn vị / Phòng ban</Label>
                  <Select value={departmentId} onValueChange={setDepartmentId}>
                    <SelectTrigger id="department">
                      <SelectValue placeholder="Chọn đơn vị" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
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
                  placeholder="Mô tả ngắn về bản thân và lĩnh vực quan tâm..."
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="google-scholar">Link Google Scholar</Label>
                <Input
                  id="google-scholar"
                  value={googleScholarUrl}
                  onChange={(e) => setGoogleScholarUrl(e.target.value)}
                  placeholder="https://scholar.google.com/citations?user=..."
                  type="url"
                />
                <p className="text-xs text-muted-foreground">
                  Dùng để đồng bộ công bố từ Google Scholar trong trang Công bố của tôi
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Định hướng / Lĩnh vực quan tâm
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newInterest}
                  onChange={(e) => setNewInterest(e.target.value)}
                  placeholder="Thêm lĩnh vực quan tâm..."
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addDirection())}
                />
                <Button onClick={addDirection} size="icon" variant="outline">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {directions.map((interest, index) => {
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
                        onClick={() => removeDirection(interest)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </Badge>
                  )
                })}
              </div>
              {directions.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">Chưa có lĩnh vực nào được khai báo</p>
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
