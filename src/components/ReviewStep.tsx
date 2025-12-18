import { useMemo, useState, useCallback } from 'react'
import { useDocumentStore } from '../stores/documentStore'
import type { Detection, DetectionCategory } from '../types'
import { Checkbox } from './ui/checkbox'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table'
import { ChevronLeft, ChevronRight, Search, ArrowUpDown } from 'lucide-react'

// Category labels
const CATEGORY_LABELS: Record<DetectionCategory, string> = {
  pii: 'Personal',
  company: 'Company',
  financial: 'Financial',
  technical: 'Technical',
  custom: 'Custom'
}

// Category colors
const categoryColors: Record<DetectionCategory, string> = {
  pii: 'bg-red-500/20 text-red-400',
  company: 'bg-blue-500/20 text-blue-400',
  financial: 'bg-green-500/20 text-green-400',
  technical: 'bg-purple-500/20 text-purple-400',
  custom: 'bg-yellow-500/20 text-yellow-400'
}

type SortField = 'text' | 'category' | 'confidence' | 'replacement'
type SortDirection = 'asc' | 'desc'

interface ReviewStepProps {
  onContinue: () => void
  onBack: () => void
}

export function ReviewStep({ onContinue, onBack }: ReviewStepProps) {
  const {
    file,
    detections,
    toggleDetection,
  } = useDocumentStore()

  const [activeCategory, setActiveCategory] = useState<DetectionCategory | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('text')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Group detections by category for counts
  const detectionsByCategory = useMemo(() => {
    const grouped: Record<DetectionCategory, Detection[]> = {
      pii: [],
      company: [],
      financial: [],
      technical: [],
      custom: []
    }
    detections.forEach(d => {
      grouped[d.category].push(d)
    })
    return grouped
  }, [detections])

  // Filter and sort detections
  const filteredDetections = useMemo(() => {
    let filtered = activeCategory === 'all'
      ? detections
      : detections.filter(d => d.category === activeCategory)

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(d =>
        d.text.toLowerCase().includes(query) ||
        d.subcategory.toLowerCase().includes(query) ||
        d.suggestedPlaceholder.toLowerCase().includes(query)
      )
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case 'text':
          comparison = a.text.localeCompare(b.text)
          break
        case 'category':
          comparison = a.category.localeCompare(b.category)
          break
        case 'confidence':
          comparison = (a.confidence || 0) - (b.confidence || 0)
          break
        case 'replacement':
          comparison = a.suggestedPlaceholder.localeCompare(b.suggestedPlaceholder)
          break
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [detections, activeCategory, searchQuery, sortField, sortDirection])

  // Stats
  const approvedCount = useMemo(() =>
    detections.filter(d => d.approved).length,
    [detections]
  )

  const filteredApprovedCount = useMemo(() =>
    filteredDetections.filter(d => d.approved).length,
    [filteredDetections]
  )

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }, [sortField])

  const handleSelectAllVisible = useCallback(() => {
    filteredDetections.forEach(d => {
      if (!d.approved) {
        toggleDetection(d.id)
      }
    })
  }, [filteredDetections, toggleDetection])

  const handleDeselectAllVisible = useCallback(() => {
    filteredDetections.forEach(d => {
      if (d.approved) {
        toggleDetection(d.id)
      }
    })
  }, [filteredDetections, toggleDetection])

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-foreground transition-colors"
    >
      {children}
      <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'opacity-100' : 'opacity-40'}`} />
    </button>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Review Detections
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {file?.fileName} · {approvedCount} of {detections.length} selected
            </p>
          </div>

          {/* Search */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-4 rounded-md text-sm bg-muted border-0 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex-shrink-0 px-6 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <FilterTab
              label="All"
              count={detections.length}
              isActive={activeCategory === 'all'}
              onClick={() => setActiveCategory('all')}
            />
            {(Object.keys(CATEGORY_LABELS) as DetectionCategory[]).map(cat => (
              detectionsByCategory[cat].length > 0 && (
                <FilterTab
                  key={cat}
                  label={CATEGORY_LABELS[cat]}
                  count={detectionsByCategory[cat].length}
                  isActive={activeCategory === cat}
                  onClick={() => setActiveCategory(cat)}
                />
              )
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDeselectAllVisible}>
              Deselect All
            </Button>
            <Button variant="outline" size="sm" onClick={handleSelectAllVisible}>
              Select All
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={filteredApprovedCount === filteredDetections.length && filteredDetections.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        handleSelectAllVisible()
                      } else {
                        handleDeselectAllVisible()
                      }
                    }}
                  />
                </TableHead>
                <TableHead>
                  <SortableHeader field="text">Original</SortableHeader>
                </TableHead>
                <TableHead className="w-32">
                  <SortableHeader field="category">Category</SortableHeader>
                </TableHead>
                <TableHead className="w-24">
                  <SortableHeader field="confidence">Confidence</SortableHeader>
                </TableHead>
                <TableHead className="w-40">
                  <SortableHeader field="replacement">Replacement</SortableHeader>
                </TableHead>
                <TableHead className="w-64">Context</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDetections.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No detections found
                  </TableCell>
                </TableRow>
              ) : (
                filteredDetections.map(detection => (
                  <TableRow
                    key={detection.id}
                    onClick={() => toggleDetection(detection.id)}
                    className={`cursor-pointer ${detection.approved ? '' : 'opacity-50'}`}
                    data-state={detection.approved ? 'selected' : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        checked={detection.approved}
                        onCheckedChange={() => toggleDetection(detection.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {detection.text}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${categoryColors[detection.category]}`}>
                        {detection.subcategory}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium ${
                        detection.confidence >= 0.8 ? 'text-green-400' :
                        detection.confidence >= 0.5 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {Math.round(detection.confidence * 100)}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
                        {detection.suggestedPlaceholder}
                      </code>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs truncate max-w-[240px]">
                      {detection.context}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-6 py-4 border-t border-border flex items-center justify-between bg-background">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {approvedCount} items will be masked
          </span>
          <Button onClick={onContinue} disabled={approvedCount === 0}>
            Continue
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// Filter tab component
function FilterTab({
  label,
  count,
  isActive,
  onClick
}: {
  label: string
  count: number
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-3 py-1.5 rounded-md text-sm font-medium transition-colors
        ${isActive
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
        }
      `}
    >
      {label}
      <span className="ml-1.5 text-xs opacity-60">{count}</span>
    </button>
  )
}
