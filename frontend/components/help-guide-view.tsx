"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { HelpCircle, Search, BookOpen, MessageCircle, FileText, FolderOpen, Sparkles, List } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"

const CATEGORY_ICONS = [BookOpen, FolderOpen, FileText, MessageCircle, Sparkles] as const
const CATEGORY_ITEM_COUNTS = [3, 3, 3, 3, 2] as const

export function HelpGuideView() {
  const [searchTerm, setSearchTerm] = useState("")
  const { t } = useLanguage()

  const helpCategories = useMemo(() => {
    return CATEGORY_ICONS.map((icon, catIndex) => {
      const itemCount = CATEGORY_ITEM_COUNTS[catIndex]
      const items = []
      for (let i = 0; i < itemCount; i++) {
        const tagsStr = t(`guide.cat${catIndex}.${i}.tags`)
        items.push({
          question: t(`guide.cat${catIndex}.${i}.q`),
          answer: t(`guide.cat${catIndex}.${i}.a`),
          tags: tagsStr ? tagsStr.split(",").map((s) => s.trim()).filter(Boolean) : [],
        })
      }
      return {
        title: t(`guide.cat${catIndex}.title`),
        icon,
        items,
      }
    })
  }, [t])

  const allItems = useMemo(
    () =>
      helpCategories.flatMap((category) =>
        category.items.map((item) => ({ ...item, category: category.title })),
      ),
    [helpCategories],
  )

  const filteredItems = searchTerm
    ? allItems.filter(
        (item) =>
          item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.answer.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase())),
      )
    : []

  return (
    <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto h-full">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <HelpCircle className="w-6 h-6" />
            {t("guide.title")}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {t("guide.subtitle")}
          </p>
        </div>

        <div className="relative mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("guide.searchPlaceholder")}
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {searchTerm && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">
              {t("guide.searchResults").replace("{count}", String(filteredItems.length))}
            </h2>
            <div className="space-y-4">
              {filteredItems.map((item, index) => (
                <Card key={index}>
                  <CardHeader>
                    <CardTitle className="text-base">{item.question}</CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {item.category}
                      </Badge>
                      {item.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{item.answer}</p>
                  </CardContent>
                </Card>
              ))}
              {filteredItems.length === 0 && (
                <p className="text-center text-muted-foreground py-8">{t("guide.noResults")}</p>
              )}
            </div>
          </div>
        )}

        {!searchTerm && (
          <div className="space-y-6">
            {helpCategories.map((category, categoryIndex) => (
              <Card key={categoryIndex}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <category.icon className="w-5 h-5" />
                    {category.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="single" collapsible>
                    {category.items.map((item, itemIndex) => (
                      <AccordionItem key={itemIndex} value={`item-${categoryIndex}-${itemIndex}`}>
                        <AccordionTrigger className="text-left">{item.question}</AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">{item.answer}</p>
                            <div className="flex flex-wrap gap-1">
                              {item.tags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <List className="w-5 h-5" />
              {t("guide.quickLinks")}
            </CardTitle>
            <CardDescription>{t("guide.quickLinksDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button variant="outline" className="justify-start h-auto py-3" asChild>
                <Link href="/welcome">
                  <div className="flex items-center gap-3 text-left">
                    <BookOpen className="w-5 h-5 shrink-0" />
                    <div>
                      <div className="font-medium">{t("guide.linkWelcome")}</div>
                      <div className="text-xs text-muted-foreground">{t("guide.linkWelcomeDesc")}</div>
                    </div>
                  </div>
                </Link>
              </Button>
              <Button variant="outline" className="justify-start h-auto py-3" asChild>
                <Link href="/assistants/central">
                  <div className="flex items-center gap-3 text-left">
                    <FileText className="w-5 h-5 shrink-0" />
                    <div>
                      <div className="font-medium">{t("guide.linkCentral")}</div>
                      <div className="text-xs text-muted-foreground">{t("guide.linkCentralDesc")}</div>
                    </div>
                  </div>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
