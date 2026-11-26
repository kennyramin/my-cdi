import { useRef, useState } from 'react'

const NO_SESSION = 0

export function useExportButton() {
  const [session, setSession] = useState(NO_SESSION)
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  function openDialog() {
    setSession((current) => current + 1)
    setIsOpen(true)
  }

  // The trigger can be disabled by the time the dialog closes, which makes the browser drop
  // focus to <body> and leaves nothing for the modal to restore: hand it back explicitly.
  function closeDialog() {
    setIsOpen(false)
    triggerRef.current?.focus()
  }

  return {
    hasBeenOpened: session > NO_SESSION,
    session,
    isOpen,
    triggerRef,
    openDialog,
    closeDialog
  } as const
}
