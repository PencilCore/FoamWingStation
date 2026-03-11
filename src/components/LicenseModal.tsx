import React from 'react';
import { Box, Typography, Modal, Backdrop, Fade } from '@mui/material';

interface LicenseModalProps {
  open: boolean;
  onClose: () => void;
}

const LicenseModal: React.FC<LicenseModalProps> = ({ open, onClose }) => {
  return (
    <Modal
      open={open}
      onClose={onClose}
      closeAfterTransition
      slots={{ backdrop: Backdrop }}
      slotProps={{
        backdrop: {
          timeout: 100, // 与 Logo 动画对齐
          sx: { 
            backdropFilter: 'blur(20px)', 
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            transition: 'all 0.1s cubic-bezier(0.4, 0, 0.1, 1) !important',
          }
        },
      }}
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        overflow: 'hidden', // 隐藏 Modal 容器的滚动条
      }}
    >
      <Fade in={open} timeout={{ enter: 300, exit: 200 }}>
        <Box sx={{
          bgcolor: 'transparent',
          p: 6,
          pt: 12, 
          width: '50%', 
          maxWidth: '850px',
          height: '100vh',
          overflowY: 'auto', 
          outline: 'none',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          textAlign: 'left',
          position: 'relative',
          zIndex: 1,
          fontFamily: '"Inter", "Segoe UI", "Roboto", sans-serif',
          // 隐藏滚动条样式
          '&::-webkit-scrollbar': {
            width: '4px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(255, 255, 255, 0.15)',
            borderRadius: '10px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: 'rgba(255, 255, 255, 0.25)',
          },
        }}>
          <Typography variant="h2" gutterBottom component="div" sx={{ 
            mb: 4, 
            fontWeight: 900, 
            letterSpacing: '-0.05em',
            fontSize: '3.5rem',
            background: 'linear-gradient(180deg, #FFFFFF 0%, rgba(255, 255, 255, 0.6) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontFamily: 'inherit'
          }}>
            Open Source License
          </Typography>
          <Box sx={{ 
            whiteSpace: 'pre-wrap', 
            fontFamily: '"Fira Code", "Cascadia Code", monospace', 
            fontSize: '1rem', 
            color: 'rgba(255, 255, 255, 0.8)',
            lineHeight: 1.8,
            flex: 1,
            letterSpacing: '0.01em',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            p: 4,
            borderRadius: 3,
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}>
            {`MIT License

Copyright (c) 2026 FoamWing Station Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`}
          </Box>
          <Box sx={{ mt: 6, opacity: 0.6 }}>
            <Typography variant="h6" gutterBottom sx={{ color: '#fff', fontWeight: 600 }}>
              Key Dependencies
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
              • React (MIT) | Material UI (MIT) | Three.js (MIT) | Vite (MIT) | TypeScript (Apache-2.0)
            </Typography>
          </Box>
        </Box>
      </Fade>
    </Modal>
  );
};

export default LicenseModal;
