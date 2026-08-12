import { useState, ReactNode } from 'react';
import { Box } from '@mui/material';

interface SlideSidebarProps {
  children: ReactNode;
  width?: number;
  collapsedWidth?: number;
}

export default function SlideSidebar({ children, width = 170, collapsedWidth = 12 }: SlideSidebarProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <Box
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{
        width: hovered ? width : collapsedWidth,
        minWidth: hovered ? width : collapsedWidth,
        transition: 'width 0.2s ease',
        position: 'relative',
        display: 'flex',
        flexShrink: 0,
        overflow: 'hidden',
        bgcolor: 'background.paper',
        borderLeft: '1px solid',
        borderColor: 'divider',
      }}
    >
      {/* 实际内容 - 固定宽度 */}
      <Box
        sx={{
          width,
          minWidth: width,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          p: 1.5,
          overflow: 'hidden',
        }}
      >
        {children}
      </Box>

      {/* 折叠时的把手 */}
      {!hovered && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: collapsedWidth,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
          }}
        >
          <Box
            sx={{
              width: 3,
              height: 28,
              bgcolor: 'rgba(255,255,255,0.15)',
              borderRadius: 2,
              transition: 'bgcolor 0.15s',
            }}
          />
        </Box>
      )}
    </Box>
  );
}