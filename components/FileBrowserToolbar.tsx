'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface FileBrowserToolbarProps {
  searchTerm: string
  onSearchChange: (term: string) => void
  sortBy: 'name' | 'size' | 'date' | 'type'
  onSortByChange: (sortBy: 'name' | 'size' | 'date' | 'type') => void
  sortOrder: 'asc' | 'desc'
  onSortOrderChange: (order: 'asc' | 'desc') => void
  onRefresh: () => void
}

export default function FileBrowserToolbar({
  searchTerm,
  onSearchChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  onRefresh
}: FileBrowserToolbarProps) {
  return (
    <div className="border-b-2 border-black p-2 space-y-2">
      {/* Search */}
      <Input
        type="text"
        placeholder="Search files..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      
      {/* Sort options */}
      <div className="flex items-center gap-2">
        <select
          value={sortBy}
          onChange={(e) => onSortByChange(e.target.value as 'name' | 'size' | 'date' | 'type')}
          className="flex-1 px-2 py-1 text-xs border-2 border-black rounded-md shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] focus:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] focus:translate-x-[2px] focus:translate-y-[2px] transition-all duration-100 focus:outline-none"
        >
          <option value="name">Name</option>
          <option value="size">Size</option>
          <option value="date">Date</option>
          <option value="type">Type</option>
        </select>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
        >
          {sortOrder === 'asc' ? '↑' : '↓'}
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          title="Refresh"
        >
          🔄
        </Button>
      </div>
    </div>
  )
}
