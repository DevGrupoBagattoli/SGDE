"use client"

import type { MouseEvent } from "react"

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { buildPaginationRange } from "@/lib/reports"
import { cn } from "@/lib/utils"

type ReportTablePaginationProps = {
  page: number
  totalPages: number
  rangeStart: number
  rangeEnd: number
  total: number
  onPageChange: (page: number) => void
  className?: string
}

export function ReportTablePagination({
  page,
  totalPages,
  rangeStart,
  rangeEnd,
  total,
  onPageChange,
  className,
}: ReportTablePaginationProps) {
  if (total === 0) return null

  const pageItems = buildPaginationRange(page, totalPages)

  const goToPage = (nextPage: number) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    if (nextPage >= 1 && nextPage <= totalPages && nextPage !== page) {
      onPageChange(nextPage)
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <p className="text-sm text-slate-500">
        {totalPages > 1 ? (
          <>
            Mostrando{" "}
            <span className="font-medium text-slate-700">
              {rangeStart}–{rangeEnd}
            </span>{" "}
            de <span className="font-medium text-slate-700">{total}</span>
          </>
        ) : (
          <>
            <span className="font-medium text-slate-700">{total}</span> registro
            {total === 1 ? "" : "s"}
          </>
        )}
      </p>

      {totalPages > 1 ? (
        <Pagination className="mx-0 w-auto justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                text="Anterior"
                className={cn(page <= 1 && "pointer-events-none opacity-50")}
                onClick={goToPage(page - 1)}
              />
            </PaginationItem>

            {pageItems.map((item, index) =>
              item === "ellipsis" ? (
                <PaginationItem key={`ellipsis-${index}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <PaginationLink
                    href="#"
                    isActive={item === page}
                    onClick={goToPage(item)}
                  >
                    {item}
                  </PaginationLink>
                </PaginationItem>
              )
            )}

            <PaginationItem>
              <PaginationNext
                href="#"
                text="Próxima"
                className={cn(page >= totalPages && "pointer-events-none opacity-50")}
                onClick={goToPage(page + 1)}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </div>
  )
}
