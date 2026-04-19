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
          pt: 16, 
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
          {/* <Typography variant="h2" gutterBottom component="div" sx={{ 
            mt:-13,
            ml:11,
            mb: 4, 
            fontWeight: 500, 
            letterSpacing: '0.01em',
            fontSize: '3.5rem',
            background: 'linear-gradient(180deg, #FFFFFF 0%, rgba(254, 255, 255, 0.95) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontFamily: 'inherit',
            p:1,
          }}> */}
            {/* Foam Wing Station
          </Typography> */}
          <Box sx={{ 
            whiteSpace: 'pre-wrap', 
            fontFamily: '"Fira Code", "Cascadia Code", monospace', 
            fontSize: '1rem', 
            color: 'rgba(255, 255, 255, 0.8)',
            lineHeight: 1.8,
            letterSpacing: '0.01em',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            p: 4,
            borderRadius: 3,
            border: '1px solid rgba(255, 255, 255, 0.05)',
            boxSizing: 'border-box',
            height: 'fit-content',
            minHeight: '200px'
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
          <Box sx={{ 
            mt: 4, 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1.5,
            bgcolor: 'rgba(255, 255, 255, 0.05)',
            p: '8px 16px',
            borderRadius: '20px',
            width: 'fit-content',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            transition: 'all 0.2s',
            cursor: 'pointer',
            textDecoration: 'none',
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.1)',
              borderColor: 'rgba(255, 255, 255, 0.2)',
              transform: 'translateY(-2px)'
            }
          }}
          component="a"
          href="https://github.com/PencilCore/FoamWingStation"
          target="_blank"
          rel="noopener noreferrer"
          >
            <svg height="24" viewBox="0 0 16 16" width="24" style={{ fill: '#fff' }}>
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            <Typography 
              variant="body2" 
              sx={{ 
                color: '#fff', 
                fontWeight: 600,
                letterSpacing: '0.02em'
              }}
            >
              GitHub Repository
            </Typography>
          </Box>
        </Box>
      </Fade>
    </Modal>
  );
};

export default LicenseModal;
