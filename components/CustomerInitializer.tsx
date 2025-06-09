// components/CustomerInitializer.tsx
"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"

export function CustomerInitializer({ onLoad }: { onLoad: (data: any) => void }) {
  const searchParams = useSearchParams()

  useEffect(() => {
    const name = searchParams.get("nome")
    const order = searchParams.get("pedido")
    const qty = searchParams.get("quantidade")

    if (name && order && qty) {
      const customerData = {
        name,
        orderNumber: order,
        quantity: Number.parseInt(qty),
        isFromUrl: true,
      }
      onLoad(customerData)
      localStorage.setItem("customerData", JSON.stringify(customerData))
      localStorage.setItem("sessionLocked", "true")
      return
    }

    const isSessionLocked = localStorage.getItem("sessionLocked") === "true"
    if (isSessionLocked) {
      const savedData = localStorage.getItem("customerData")
      if (savedData) {
        const data = JSON.parse(savedData)
        onLoad({ ...data, isFromUrl: false })
      }
    }
  }, [searchParams, onLoad])

  return null
}
