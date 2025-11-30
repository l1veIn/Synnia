import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export default function DemoPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Badge variant="secondary" className="uppercase tracking-wide">
          {t("nav.demo")}
        </Badge>
        <h1 className="text-2xl font-semibold tracking-tight">{t("demo.title")}</h1>
        <p className="text-muted-foreground">{t("demo.desc")}</p>
      </div>

      <Card className="shadow-sm border-border/60">
        <CardHeader>
          <CardTitle>{t("demo.tabs.title")}</CardTitle>
          <CardDescription>{t("demo.tabs.desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="one" className="w-full">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="one">{t("demo.tabs.one")}</TabsTrigger>
              <TabsTrigger value="two">{t("demo.tabs.two")}</TabsTrigger>
              <TabsTrigger value="three">{t("demo.tabs.three")}</TabsTrigger>
            </TabsList>
            <TabsContent value="one" className="space-y-2 text-sm text-muted-foreground">
              {t("demo.tabs.content_one")}
            </TabsContent>
            <TabsContent value="two" className="space-y-2 text-sm text-muted-foreground">
              {t("demo.tabs.content_two")}
            </TabsContent>
            <TabsContent value="three" className="space-y-2 text-sm text-muted-foreground">
              {t("demo.tabs.content_three")}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
