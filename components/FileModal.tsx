'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface FileModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (value?: string) => void
  title: string
  type: 'input' | 'confirm' | 'select'
  message?: string
  inputLabel?: string
  inputPlaceholder?: string
  defaultValue?: string
  initialValue?: string
  options?: { label: string; value: string; icon?: string }[]
}

export default function FileModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  type,
  message,
  inputLabel,
  inputPlaceholder,
  defaultValue = '',
  initialValue,
  options = []
}: FileModalProps) {
  const [inputValue, setInputValue] = useState(initialValue || defaultValue)
  const [selectedOption, setSelectedOption] = useState(options[0]?.value || '')

  if (!isOpen) return null

  const handleConfirm = () => {
    if (type === 'input') {
      if (inputValue.trim()) {
        onConfirm(inputValue.trim())
        setInputValue('')
      }
    } else if (type === 'select') {
      onConfirm(selectedOption)
    } else {
      onConfirm()
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white border-2 border-black rounded-lg shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 max-w-md w-full mx-4">
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        
        {message && (
          <p className="text-gray-600 mb-4">{message}</p>
        )}

        {type === 'input' && (
          <div className="mb-4">
            {inputLabel && (
              <label className="block text-sm font-medium mb-2">
                {inputLabel}
              </label>
            )}
            <Input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={inputPlaceholder}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleConfirm()
                } else if (e.key === 'Escape') {
                  onClose()
                }
              }}
            />
          </div>
        )}

        {type === 'select' && (
          <div className="mb-4">
            <div className="grid grid-cols-2 gap-2">
              {options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSelectedOption(option.value)}
                  className={`
                    p-4 border-2 border-black rounded-lg text-left
                    hover:bg-gray-50 transition-colors
                    ${selectedOption === option.value 
                      ? 'bg-blue-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' 
                      : 'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'}
                  `}
                >
                  <div className="text-2xl mb-1">{option.icon}</div>
                  <div className="font-semibold">{option.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {type === 'confirm' && (
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded p-3 mb-4">
            <p className="text-sm">⚠️ This action cannot be undone.</p>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant={type === 'confirm' ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={type === 'input' && !inputValue.trim()}
          >
            {type === 'confirm' ? 'Delete' : type === 'select' ? 'Create' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  )
}