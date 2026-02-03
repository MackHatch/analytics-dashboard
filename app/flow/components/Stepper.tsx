'use client'

import { Step } from '../lib/runtime/types'

interface StepperProps {
  currentStep: Step
  completedSteps: Step[]
}

const STEP_ORDER: Step[] = [
  Step.CONNECT,
  Step.INPUTS,
  Step.QUOTE,
  Step.APPROVE_IN,
  Step.SWAP,
  Step.APPROVE_OUT,
  Step.CREATE_STREAM,
  Step.WAIT_INDEXED,
  Step.DONE,
]

const STEP_LABELS: Record<Step, string> = {
  [Step.CONNECT]: 'Connect',
  [Step.INPUTS]: 'Inputs',
  [Step.QUOTE]: 'Quote',
  [Step.APPROVE_IN]: 'Approve In',
  [Step.SWAP]: 'Swap',
  [Step.APPROVE_OUT]: 'Approve Out',
  [Step.CREATE_STREAM]: 'Create Stream',
  [Step.WAIT_INDEXED]: 'Indexing',
  [Step.DONE]: 'Done',
  [Step.ERROR]: 'Error',
}

export function Stepper({ currentStep, completedSteps }: StepperProps) {
  const currentIndex = STEP_ORDER.indexOf(currentStep)
  const isError = currentStep === Step.ERROR

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {STEP_ORDER.map((step, index) => {
          if (step === Step.ERROR) return null // Don't show error in stepper

          const isCompleted = completedSteps.includes(step)
          const isCurrent = step === currentStep
          const isPast = index < currentIndex

          return (
            <div key={step} className="flex items-center flex-1">
              {/* Step Circle */}
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-colors ${
                    isError && isCurrent
                      ? 'bg-red-500 text-white'
                      : isCompleted || isPast
                      ? 'bg-blue-500 text-white'
                      : isCurrent
                      ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-200 border-2 border-blue-500'
                      : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}
                >
                  {isCompleted ? '✓' : index + 1}
                </div>
                <span
                  className={`mt-2 text-xs text-center ${
                    isCurrent
                      ? 'font-semibold text-blue-600 dark:text-blue-400'
                      : isCompleted || isPast
                      ? 'text-zinc-600 dark:text-zinc-400'
                      : 'text-zinc-400 dark:text-zinc-600'
                  }`}
                >
                  {STEP_LABELS[step]}
                </span>
              </div>

              {/* Connector Line */}
              {index < STEP_ORDER.length - 1 && STEP_ORDER[index + 1] !== Step.ERROR && (
                <div
                  className={`h-1 flex-1 mx-2 ${
                    isCompleted || isPast
                      ? 'bg-blue-500'
                      : 'bg-zinc-200 dark:bg-zinc-800'
                  }`}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
