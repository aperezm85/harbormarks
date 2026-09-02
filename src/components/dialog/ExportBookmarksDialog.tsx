import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DownloadSimpleIcon } from "@phosphor-icons/react"
import { useState, type ReactNode } from "react"

type ExportFormat = "json" | "csv" | "html"

const EXPORT_FORMAT_OPTIONS: Array<{
   value: ExportFormat
   label: string
   description: string
 }> = [
  {
     value: "json",
     label: "JSON",
     description: "Full, lossless copy for re-importing or backing up.",
     },
  {
     value: "csv",
     label: "CSV",
     description: "A spreadsheet-friendly table of your bookmarks.",
     },
  {
     value: "html",
     label: "HTML",
     description: "Netscape format that imports into any browser.",
     },
]

export const ExportBookmarksDialog = ({
trigger,
}: {
    trigger?: ReactNode
}) => {
   const [format, setFormat] = useState<ExportFormat>("json")

   const downloadHref = `/api/bookmarks/export?format=${format}`

   return (
       <Dialog>
         <DialogTrigger asChild>
           {trigger ?? (
             <Button variant="ghost" className="h-auto w-full justify-start">
               <DownloadSimpleIcon className="size-4" />
               <span className="ml-2">Export bookmarks</span>
             </Button>
           )}
         </DialogTrigger>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Export bookmarks</DialogTitle>
             <DialogDescription>
               Download every bookmark as a file you own.
             </DialogDescription>
           </DialogHeader>
           <div className="flex flex-col gap-1">
             <Select
               value={format}
               onValueChange={(value) => setFormat(value as ExportFormat)}
             >
               <SelectTrigger className="w-full">
                 <SelectValue placeholder="Choose a format" />
               </SelectTrigger>
               <SelectContent>
                 {EXPORT_FORMAT_OPTIONS.map((option) => (
                   <SelectItem key={option.value} value={option.value}>
                     {option.label}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
             <p className="text-xs text-muted-foreground">
               {EXPORT_FORMAT_OPTIONS.find((option) => option.value === format)
                   ?.description}
             </p>
           </div>
           <DialogFooter>
             <DialogClose asChild>
               <Button variant="outline" type="button">
                 Cancel
               </Button>
             </DialogClose>
             <a href={downloadHref} download>
               <Button type="button">
                 <DownloadSimpleIcon
                    className="size-4"
                    data-icon="inline-start"
                 />
                 Download
               </Button>
             </a>
           </DialogFooter>
         </DialogContent>
       </Dialog>
     )
}
