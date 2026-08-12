import { useState } from 'react'
import { Box, Button } from '@mui/material'
import TwoPreview from './TwoPreview'
import ThreePreview from './ThreePreview'

export default function DesignPreview() {
  const [show2D, setShow2D] = useState(false)

  return (
    <Box display="flex" flexDirection="column" height="100%" minHeight={0} position="relative">
      {show2D && (
        <Box height="30%" minHeight={150} borderBottom="1px solid #2e2e2e" overflow="hidden">
          <TwoPreview />
        </Box>
      )}
      <Box flex={1} minHeight={0}>
        <ThreePreview />
      </Box>

      {/* 右上角2D视图呼出按钮 */}
      <Button
        onClick={() => setShow2D(prev => !prev)}
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 10,
          minWidth: 40,
          height: 28,
          p: '2px 8px',
          bgcolor: show2D ? 'rgba(59,130,246,0.25)' : 'rgba(0,0,0,0.5)',
          border: '1px solid',
          borderColor: show2D ? 'rgba(96,165,250,0.4)' : 'rgba(255,255,255,0.1)',
          color: show2D ? '#60a5fa' : '#a3a3a3',
          borderRadius: 1,
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          '&:hover': { bgcolor: show2D ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.1)' },
        }}
      >
        2D
      </Button>
    </Box>
  )
}