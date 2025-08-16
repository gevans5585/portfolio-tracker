'use client';

import { useEffect, useRef } from 'react';

interface SparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  className?: string;
}

export default function Sparkline({ 
  data, 
  color = '#54656D', 
  width = 80, 
  height = 32, 
  className = '' 
}: SparklineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current || !data || data.length === 0) return;

    // Wait for Chart.js to be available
    const initChart = () => {
      if (typeof window !== 'undefined' && (window as any).Chart) {
        const Chart = (window as any).Chart;
        
        // Destroy previous chart instance
        if (chartRef.current) {
          chartRef.current.destroy();
        }

        const ctx = canvasRef.current!.getContext('2d');
        
        chartRef.current = new Chart(ctx, {
          type: 'line',
          data: {
            labels: data.map((_, index) => index),
            datasets: [{
              data: data,
              borderColor: color,
              backgroundColor: 'transparent',
              borderWidth: 2,
              pointRadius: 0,
              pointHoverRadius: 0,
              tension: 0.4,
              fill: false
            }]
          },
          options: {
            responsive: false,
            maintainAspectRatio: false,
            animation: {
              duration: 500,
              easing: 'easeInOutQuart'
            },
            interaction: {
              intersect: false
            },
            plugins: {
              legend: {
                display: false
              },
              tooltip: {
                enabled: false
              }
            },
            scales: {
              x: {
                display: false,
                grid: {
                  display: false
                }
              },
              y: {
                display: false,
                grid: {
                  display: false
                }
              }
            },
            elements: {
              point: {
                radius: 0
              }
            }
          }
        });
      } else {
        // Chart.js not loaded yet, try again
        setTimeout(initChart, 100);
      }
    };

    initChart();

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [data, color]);

  return (
    <div className={`sparkline-container ${className}`} style={{ width, height }}>
      <canvas 
        ref={canvasRef}
        width={width}
        height={height}
        className="block"
      />
    </div>
  );
}

// Generate sample data for demonstration
export function generateSampleSparklineData(baseReturn: number, months: number = 12): number[] {
  const data = [];
  let current = 0;
  
  for (let i = 0; i < months; i++) {
    // Generate realistic return progression toward baseReturn
    const variation = (Math.random() - 0.5) * 4; // ±2% variation
    const trend = (baseReturn / months) * (i + 1); // Gradual trend toward final return
    current = trend + variation;
    data.push(current);
  }
  
  return data;
}