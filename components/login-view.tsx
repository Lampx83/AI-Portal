"use client"

import { useState } from "react" // Add useState import
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Image from "next/image"
import { KeyRound } from "lucide-react"

interface LoginViewProps {
  onSsoLogin: () => void
  onUsernamePasswordLogin: (username: string, password: string) => void // Update prop signature
}

export function LoginView({ onSsoLogin, onUsernamePasswordLogin }: LoginViewProps) {
  const [username, setUsername] = useState("nguyenvana") // Add state for username
  const [password, setPassword] = useState("password") // Add state for password

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-100 to-blue-100 dark:from-gray-900 dark:to-blue-950">
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Image src="/neu-logo.svg" alt="NEU Logo" width={64} height={64} />
          </div>
          <CardTitle className="text-2xl">NEU Research</CardTitle>
          <CardDescription>Đăng nhập để tiếp tục</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Tên đăng nhập</Label>
            <Input
              id="username"
              placeholder="Ví dụ: nguyenvana"
              required
              value={username} // Bind value
              onChange={(e) => setUsername(e.target.value)} // Add onChange
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mật khẩu</Label>
            <Input
              id="password"
              type="password"
              required
              value={password} // Bind value
              onChange={(e) => setPassword(e.target.value)} // Add onChange
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button className="w-full" onClick={() => onUsernamePasswordLogin(username, password)}>
            Đăng nhập
          </Button>
          <div className="relative w-full">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Hoặc</span>
            </div>
          </div>
          <Button variant="outline" className="w-full bg-transparent" onClick={onSsoLogin}>
            <KeyRound className="mr-2 h-4 w-4" />
            Đăng nhập với Microsoft
          </Button>
          <Button variant="link" className="text-sm font-normal">
            Quên mật khẩu?
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
