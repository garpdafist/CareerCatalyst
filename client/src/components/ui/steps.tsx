import { Check } from "lucide-react";

interface Step {
  label: string;
  description?: string;
}

interface StepsProps {
  steps: Step[];
  currentStep: number;
}

export function Steps({ steps, currentStep }: StepsProps) {
  return (
    <div className="relative">
      <div className="flex justify-between">
        {steps.map((step, index) => {
          const isCompleted = currentStep > index;
          const isCurrent = currentStep === index;

          return (
            <div
              key={step.label}
              className={`flex flex-col items-center flex-1 ${
                index !== steps.length - 1 ? "relative" : ""
              }`}
            >
              {/* Line connector */}
              {index !== steps.length - 1 && (
                <div
                  className={`absolute top-5 left-1/2 w-full h-[2px] ${
                    isCompleted ? "bg-primary" : "bg-border"
                  }`}
                />
              )}

              {/* Step circle */}
              <div
                className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  isCompleted
                    ? "bg-primary border-primary text-primary-foreground"
                    : isCurrent
                    ? "border-primary bg-background text-primary"
                    : "border-border bg-background text-muted-foreground"
                }`}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>

              {/* Step label */}
              <div className="mt-2 text-center">
                <div
                  className={`text-sm font-medium ${
                    isCurrent ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </div>
                {step.description && (
                  <div className="text-xs text-muted-foreground mt-1 max-w-[120px]">
                    {step.description}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
