"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Shield, Server, Globe, Copy, Check } from "lucide-react"
import { useSession } from "next-auth/react"
import { API_CONFIG } from "@/lib/config"

export function AdminView() {
  const { data: session } = useSession()
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(fieldName)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto h-full">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Quản trị hệ thống
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Thông tin hệ thống và cấu hình cho quản trị viên
          </p>
        </div>

        <Card className="border-2 border-blue-500 dark:border-blue-400">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <Shield className="w-5 h-5" />
              Thông tin hệ thống
            </CardTitle>
            <CardDescription>Thông tin cấu hình và môi trường</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Backend API URL */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  Backend API URL
                </Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-md text-sm break-all">
                    {API_CONFIG.baseUrl}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(API_CONFIG.baseUrl, "backend")}
                    className="shrink-0"
                  >
                    {copiedField === "backend" ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Frontend URL */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Frontend URL
                </Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-md text-sm break-all">
                    {typeof window !== "undefined" ? window.location.origin : "N/A"}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      copyToClipboard(
                        typeof window !== "undefined" ? window.location.origin : "",
                        "frontend"
                      )
                    }
                    className="shrink-0"
                  >
                    {copiedField === "frontend" ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Environment */}
              <div className="space-y-2">
                <Label>Môi trường</Label>
                <div className="px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-md text-sm">
                  {process.env.NODE_ENV || "development"}
                </div>
              </div>

              {/* User Email */}
              <div className="space-y-2">
                <Label>Email đăng nhập</Label>
                <div className="px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-md text-sm break-all">
                  {session?.user?.email || "N/A"}
                </div>
              </div>
            </div>

            {/* Additional Info */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <Label className="text-sm font-semibold mb-2 block">Thông tin bổ sung</Label>
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex justify-between">
                  <span>Node.js Version:</span>
                  <span className="font-mono">{process.env.NEXT_PUBLIC_NODE_VERSION || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Build Time:</span>
                  <span className="font-mono">
                    {process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString()}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
