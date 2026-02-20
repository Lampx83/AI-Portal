"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Users, Calendar, ExternalLink } from "lucide-react"
import type { Publication } from "@/lib/api/publications"

type Props = {
    items: Publication[]
    viewMode: "card" | "list"
    onItemClick: (pub: Publication) => void
}

const getStatusColor = (status: Publication["status"]) => {
    switch (status) {
        case "published":
            return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
        case "accepted":
            return "bg-primary/10 text-primary"
        case "submitted":
            return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
        case "draft":
        default:
            return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300"
    }
}
const getStatusText = (status: Publication["status"]) =>
    ({ published: "Đã xuất bản", accepted: "Đã chấp nhận", submitted: "Đã nộp", draft: "Bản thảo" } as const)[status]

const getTypeText = (type: Publication["type"]) =>
    ({ journal: "Tạp chí", conference: "Hội thảo", book: "Sách", thesis: "Luận văn" } as const)[type]

export function PublicationsList({ items, viewMode, onItemClick }: Props) {
    if (viewMode === "list") {
        return (
            <div className="space-y-2">
                {items.map((p) => (
                    <div
                        key={p.id}
                        className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                        onClick={() => onItemClick(p)}
                    >
                        <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">{p.title}</h3>
                            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                                <span>{p.authors.join(", ")}</span>
                                <span>•</span>
                                <span>{p.journal ?? "—"}</span>
                                <span>•</span>
                                <span>{p.year ?? "—"}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                            <Badge className={getStatusColor(p.status)} variant="secondary">{getStatusText(p.status)}</Badge>
                            <Badge variant="outline">{getTypeText(p.type)}</Badge>
                            <Button variant="ghost" size="sm"><ExternalLink className="w-4 h-4" /></Button>
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    // card view
    return (
        <div className="space-y-4">
            {items.map((p) => (
                <Card
                    key={p.id}
                    className="hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => onItemClick(p)}
                >
                    <CardHeader>
                        <div className="flex justify-between items-start gap-4">
                            <div className="flex-1">
                                <CardTitle className="text-lg leading-tight mb-2">{p.title}</CardTitle>
                                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                    <div className="flex items-center gap-1">
                                        <Users className="w-4 h-4" />
                                        <span>{p.authors.join(", ")}</span>
                                    </div>
                                    <span>•</span>
                                    <div className="flex items-center gap-1">
                                        <Calendar className="w-4 h-4" />
                                        <span>{p.year ?? "—"}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Badge className={getStatusColor(p.status)}>{getStatusText(p.status)}</Badge>
                                <Badge variant="outline">{getTypeText(p.type)}</Badge>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            <div>
                                <p className="font-medium text-sm text-gray-700 dark:text-gray-300">{p.journal ?? "—"}</p>
                                {p.doi && <p className="text-xs text-gray-500 dark:text-gray-400">DOI: {p.doi}</p>}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{p.abstract ?? ""}</p>
                            <div className="flex justify-end">
                                <Button variant="ghost" size="sm">
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    Xem chi tiết
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}
