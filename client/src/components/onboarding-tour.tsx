import { useEffect, useState } from 'react';
import Shepherd from 'shepherd.js';
import 'shepherd.js/dist/css/shepherd.css';

export function OnboardingTour() {
  const [tour, setTour] = useState<Shepherd.Tour | null>(null);

  useEffect(() => {
    // Check if user has seen the tour before
    const hasTakenTour = localStorage.getItem('hasTakenTour');
    if (hasTakenTour) return;

    const newTour = new Shepherd.Tour({
      useModalOverlay: true,
      defaultStepOptions: {
        classes: 'shadow-xl rounded-xl bg-[#F5F0E5] border-0',
        scrollTo: true,
        popperOptions: {
          modifiers: [{ name: 'offset', options: { offset: [0, 12] } }],
        },
        when: {
          show: () => {
            const currentStepElement = newTour.currentStep?.el;
            if (currentStepElement) {
              currentStepElement.querySelector('.shepherd-button')?.classList.add(
                'btn',
                'btn-primary',
                'text-white',
                'rounded-full',
                'px-6',
                'py-2.5',
                'h-11',
                'shadow-sm',
                'transition-all',
                'duration-300'
              );

              // Style the skip button differently
              currentStepElement.querySelector('.shepherd-button:first-child')?.classList.add(
                'btn-secondary',
                'bg-white',
                'text-[#009963]',
                'border-2',
                'border-[#009963]/20'
              );
            }
          },
        },
      },
    });

    // Define tour steps
    newTour.addSteps([
      {
        id: 'welcome',
        text: `<div class="p-4">
          <h3 class="text-[#1C170D] text-xl font-semibold mb-2">Welcome to CareerAI!</h3>
          <p class="text-[#757575] mb-4">Let's take a quick tour to help you get started.</p>
        </div>`,
        buttons: [
          {
            text: 'Skip Tour',
            action: () => {
              localStorage.setItem('hasTakenTour', 'true');
              newTour.complete();
            },
            classes: 'mr-2'
          },
          {
            text: 'Start Tour',
            action: () => newTour.next(),
          }
        ]
      },
      {
        id: 'resume-analyzer',
        attachTo: { 
          element: '[data-tour="resume-analyzer"]', 
          on: 'bottom' 
        },
        text: `<div class="p-4">
          <h3 class="text-[#1C170D] text-xl font-semibold mb-2">Resume Analyzer</h3>
          <p class="text-[#757575] mb-4">Upload your resume to get instant AI-powered feedback and suggestions.</p>
        </div>`,
        buttons: [
          {
            text: 'Next',
            action: () => newTour.next(),
          }
        ]
      },
      {
        id: 'resume-editor',
        attachTo: { 
          element: '[data-tour="resume-editor"]', 
          on: 'bottom' 
        },
        text: `<div class="p-4">
          <h3 class="text-[#1C170D] text-xl font-semibold mb-2">Resume Editor</h3>
          <p class="text-[#757575] mb-4">Use our intelligent editor to craft the perfect resume with real-time guidance.</p>
        </div>`,
        buttons: [
          {
            text: 'Next',
            action: () => newTour.next(),
          }
        ]
      },
      {
        id: 'finish',
        text: `<div class="p-4">
          <h3 class="text-[#1C170D] text-xl font-semibold mb-2">You're All Set!</h3>
          <p class="text-[#757575] mb-4">Start by analyzing your resume to get personalized suggestions.</p>
        </div>`,
        buttons: [
          {
            text: 'Get Started',
            action: () => {
              localStorage.setItem('hasTakenTour', 'true');
              newTour.complete();
            },
          }
        ]
      }
    ]);

    setTour(newTour);
    newTour.start();

    return () => {
      newTour.complete();
    };
  }, []);

  return null; // This is a utility component, it doesn't render anything
}