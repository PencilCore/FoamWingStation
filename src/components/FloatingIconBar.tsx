import { ReactNode } from 'react';
import { Box, Tooltip } from '@mui/material';

export interface IconBarItem {
  value: number;
  label: string;
  icon: ReactNode;
}

interface FloatingIconBarProps {
  items: IconBarItem[];
  value: number;
  onChange: (value: number) => void;
}

export default function FloatingIconBar({ items, value, onChange }: FloatingIconBarProps) {
  return (
    <Box
      sx={{
        position: 'absolute',
        right: 8,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        p: 0.5,
        bgcolor: 'rgba(18,18,18,0.85)',
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(8px)',
      }}
    >
      {items.map((item) => {
        const active = value === item.value;
        return (
          <Tooltip key={item.value} title={item.label} placement="right" arrow>
            <Box
              onClick={() => onChange(item.value)}
              sx={{
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 1.5,
                cursor: 'pointer',
                color: active ? '#60a5fa' : '#6b7280',
                bgcolor: active ? 'rgba(96,165,250,0.15)' : 'transparent',
                transition: 'all 0.15s',
                '&:hover': {
                  color: '#94a3b8',
                  bgcolor: 'rgba(255,255,255,0.06)',
                },
                '& svg': {
                  fontSize: 18,
                },
              }}
            >
              {item.icon}
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}