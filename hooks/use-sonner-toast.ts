import { toast as sonnerToast } from "sonner"

type ToastProps = {
  title?: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function useToast() {
  const toast = ({ title, description, action }: ToastProps) => {
    return sonnerToast(title, {
      description,
      action: action && {
        label: action.label,
        onClick: action.onClick,
      },
    })
  }

  const success = ({ title, description, action }: ToastProps) => {
    return sonnerToast.success(title, {
      description,
      action: action && {
        label: action.label,
        onClick: action.onClick,
      },
    })
  }

  const error = ({ title, description, action }: ToastProps) => {
    return sonnerToast.error(title, {
      description,
      action: action && {
        label: action.label,
        onClick: action.onClick,
      },
    })
  }

  const warning = ({ title, description, action }: ToastProps) => {
    return sonnerToast.warning(title, {
      description,
      action: action && {
        label: action.label,
        onClick: action.onClick,
      },
    })
  }

  const info = ({ title, description, action }: ToastProps) => {
    return sonnerToast.info(title, {
      description,
      action: action && {
        label: action.label,
        onClick: action.onClick,
      },
    })
  }

  return {
    toast,
    success,
    error,
    warning,
    info,
  }
} 