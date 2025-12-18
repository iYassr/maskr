import { useState, useCallback } from 'react'
import { useConfigStore } from '../stores/configStore'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import { X, Plus, User, Key } from 'lucide-react'

interface ConfigModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConfigModal({ open, onOpenChange }: ConfigModalProps) {
  const { config, addKeyword, removeKeyword, addName, removeName } = useConfigStore()
  const [newKeyword, setNewKeyword] = useState('')
  const [newName, setNewName] = useState('')

  const handleAddKeyword = useCallback(() => {
    if (newKeyword.trim()) {
      addKeyword(newKeyword.trim())
      setNewKeyword('')
    }
  }, [newKeyword, addKeyword])

  const handleAddName = useCallback(() => {
    if (newName.trim()) {
      addName(newName.trim())
      setNewName('')
    }
  }, [newName, addName])

  const handleKeywordKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddKeyword()
    }
  }, [handleAddKeyword])

  const handleNameKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddName()
    }
  }, [handleAddName])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Detection Settings</DialogTitle>
          <DialogDescription>
            Configure custom keywords and names to detect in documents.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            {/* Custom Names Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <label className="text-sm font-medium">Custom Names</label>
              </div>
              <p className="text-xs text-muted-foreground">
                Add names of people to detect (e.g., employees, clients)
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={handleNameKeyDown}
                  placeholder="Enter a name..."
                  className="flex-1 px-3 py-2 text-sm rounded-md border bg-background"
                />
                <Button size="sm" onClick={handleAddName} disabled={!newName.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {(!config.customEntities?.names || config.customEntities.names.length === 0) ? (
                  <p className="text-xs text-muted-foreground italic">No custom names added</p>
                ) : (
                  config.customEntities.names.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/20 text-red-400 text-xs"
                    >
                      {name}
                      <button
                        onClick={() => removeName(name)}
                        className="hover:text-red-300"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Custom Keywords Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-muted-foreground" />
                <label className="text-sm font-medium">Custom Keywords</label>
              </div>
              <p className="text-xs text-muted-foreground">
                Add sensitive keywords or terms to detect
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={handleKeywordKeyDown}
                  placeholder="Enter a keyword..."
                  className="flex-1 px-3 py-2 text-sm rounded-md border bg-background"
                />
                <Button size="sm" onClick={handleAddKeyword} disabled={!newKeyword.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {(!config.customEntities?.keywords || config.customEntities.keywords.length === 0) ? (
                  <p className="text-xs text-muted-foreground italic">No custom keywords added</p>
                ) : (
                  config.customEntities.keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-yellow-500/20 text-yellow-400 text-xs"
                    >
                      {keyword}
                      <button
                        onClick={() => removeKeyword(keyword)}
                        className="hover:text-yellow-300"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
