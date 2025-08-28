
import { cn } from '@/lib/utils';
import * as React from 'react';

export function ScalerLogo({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className={cn('h-8 w-8', className)}
      {...props}
    >
      <g fill="currentColor">
        <path d="M35.6,56.1l-18.4,18.4c-0.8,0.8-2.1,0.8-2.8,0l-5.3-5.3c-0.8-0.8-0.8-2.1,0-2.8l21.2-21.2c0.8-0.8,2.1-0.8,2.8,0l5.3,5.3C39.2,51.2,38.3,53.4,35.6,56.1z"></path>
        <path d="M64.4,43.9l18.4-18.4c0.8-0.8,0.8-2.1,0-2.8l-5.3-5.3c-0.8-0.8-2.1-0.8-2.8,0L53.5,38.6c-0.8,0.8-0.8,2.1,0,2.8l5.3,5.3C60.8,48.8,61.7,46.6,64.4,43.9z"></path>
        <path d="M40.9,78.5l18.4-18.4c0.8-0.8,2.1-0.8,2.8,0l5.3,5.3c0.8,0.8,0.8,2.1,0,2.8L46.2,89.5c-0.8,0.8-2.1,0.8-2.8,0l-5.3-5.3C37.3,83.4,38.3,81.2,40.9,78.5z"></path>
      </g>
    </svg>
  );
}
