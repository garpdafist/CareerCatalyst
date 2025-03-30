import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
}

/**
 * A modern OTP input component that provides an intuitive interface for entering
 * one-time passwords with auto-focus and keyboard navigation.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled = false,
  className,
  inputClassName,
}: OtpInputProps) {
  const [otp, setOtp] = useState<string[]>(
    value.split("").concat(Array(length - value.length).fill(""))
  );
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Update internal state when external value changes
  useEffect(() => {
    setOtp(value.split("").concat(Array(length - value.length).fill("")));
  }, [value, length]);

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const newValue = e.target.value;
    
    // If the input already has a value and the user types another, replace it
    if (newValue.length > 1) {
      const newChars = newValue.split("");
      
      // Update current input and potentially following inputs
      const newOtp = [...otp];
      for (let i = 0; i < newChars.length && index + i < length; i++) {
        newOtp[index + i] = newChars[i];
      }
      
      setOtp(newOtp);
      onChange(newOtp.join(""));
      
      // Focus the next empty input or the last input
      const nextIndex = Math.min(index + newChars.length, length - 1);
      inputRefs.current[nextIndex]?.focus();
    } else {
      // Handle single character input
      const newOtp = [...otp];
      newOtp[index] = newValue;
      setOtp(newOtp);
      onChange(newOtp.join(""));
      
      // Auto-focus next input if value was entered
      if (newValue !== "") {
        const nextIndex = index + 1;
        if (nextIndex < length) {
          inputRefs.current[nextIndex]?.focus();
        }
      }
    }
  };

  // Handle keyboard navigation and deletion
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Backspace") {
      if (otp[index] === "") {
        // If current input is empty, focus and clear previous input
        const prevIndex = index - 1;
        if (prevIndex >= 0) {
          const newOtp = [...otp];
          newOtp[prevIndex] = "";
          setOtp(newOtp);
          onChange(newOtp.join(""));
          inputRefs.current[prevIndex]?.focus();
        }
      } else {
        // Clear current input
        const newOtp = [...otp];
        newOtp[index] = "";
        setOtp(newOtp);
        onChange(newOtp.join(""));
      }
    } else if (e.key === "ArrowLeft") {
      // Move focus to previous input
      const prevIndex = index - 1;
      if (prevIndex >= 0) {
        inputRefs.current[prevIndex]?.focus();
      }
    } else if (e.key === "ArrowRight") {
      // Move focus to next input
      const nextIndex = index + 1;
      if (nextIndex < length) {
        inputRefs.current[nextIndex]?.focus();
      }
    }
  };

  // Handle paste event
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, index: number) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text/plain").trim();
    
    if (!pastedData) return;
    
    // If the pasted data contains only digits and its length is less than or equal to the remaining inputs
    if (/^\d+$/.test(pastedData)) {
      const pastedChars = pastedData.split("");
      const newOtp = [...otp];
      
      // Fill in as many inputs as possible with the pasted characters
      for (let i = 0; i < pastedChars.length && index + i < length; i++) {
        newOtp[index + i] = pastedChars[i];
      }
      
      setOtp(newOtp);
      onChange(newOtp.join(""));
      
      // Focus the next empty input or the last input
      const nextIndex = Math.min(index + pastedChars.length, length - 1);
      inputRefs.current[nextIndex]?.focus();
    }
  };

  return (
    <div 
      className={cn(
        "flex gap-2 justify-center items-center", 
        className
      )}
    >
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(el) => (inputRefs.current[index] = el)}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={otp[index] || ""}
          onChange={(e) => handleChange(e, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onPaste={(e) => handlePaste(e, index)}
          disabled={disabled}
          className={cn(
            "w-10 h-12 text-center rounded-md border border-border/50",
            "text-lg font-medium bg-background",
            "transition-all duration-200",
            disabled && "opacity-50 cursor-not-allowed",
            inputClassName
          )}
          style={{
            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
          }}
          aria-label={`Digit ${index + 1} of one-time password`}
        />
      ))}
    </div>
  );
}