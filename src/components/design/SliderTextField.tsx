import { Box, Slider, TextField, Typography } from '@mui/material';

interface SliderTextFieldProps {
  label: string;
  name: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (name: string, value: number) => void;
  helperText?: string;
  unit?: string;
}

export default function SliderTextField({
  label,
  name,
  value,
  min,
  max,
  step = 1,
  onChange,
  helperText,
  unit = ''
}: SliderTextFieldProps) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="caption" sx={{ color: '#94a3b8', mb: 0.5, display: 'block', fontWeight: 600 }}>
        {label} {unit && `(${unit})`}
      </Typography>
      <Box display="flex" alignItems="center" gap={3}>
        <Box flex={1}>
          <Slider
            value={typeof value === 'number' ? value : 0}
            min={min}
            max={max}
            step={step}
            onChange={(_, v) => onChange(name, v as number)}
            sx={{
              color: '#38bdf8',
              '& .MuiSlider-thumb': {
                width: 14,
                height: 14,
                transition: '0.3s cubic-bezier(.47,1.64,.41,.8)',
                '&:before': {
                  boxShadow: '0 2px 12px 0 rgba(0,0,0,0.4)',
                },
                '&:hover, &.Mui-focusVisible': {
                  boxShadow: '0px 0px 0px 8px rgba(56, 189, 248, 0.16)',
                },
              },
            }}
          />
        </Box>
        <Box sx={{ width: 100 }}>
          <TextField
            type="number"
            value={value}
            onChange={(e) => onChange(name, Number(e.target.value))}
            size="small"
            fullWidth
            helperText={helperText}
            inputProps={{ step }}
            sx={{
              '& .MuiInputBase-input': {
                fontFamily: 'JetBrains Mono, monospace',
                textAlign: 'center',
                fontSize: '0.9rem'
              }
            }}
          />
        </Box>
      </Box>
    </Box>
  );
}
