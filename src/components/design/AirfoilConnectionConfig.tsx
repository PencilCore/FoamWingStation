// components/AirfoilConnectionConfig.tsx
// 去重后改为「翼型连接概览」：只读汇总根/尖翼型与偏移状态，
// 编辑入口分别在「翼根配置」「翼尖配置」「双翼排布」。
import { Box, Typography, Divider, Chip } from '@mui/material';
import { useWing } from '../../hooks/useWing';

interface InfoRowProps {
  label: string;
  value: React.ReactNode;
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, py: 0.75 }}>
      <Typography variant="caption" sx={{ color: 'design.slate' }}>{label}</Typography>
      {/* 用 Box 而非 Typography(p)，避免嵌套 Chip(div) 造成非法 HTML */}
      <Box sx={{ color: 'design.text', fontWeight: 600, fontSize: '0.875rem', textAlign: 'right' }}>{value}</Box>
    </Box>
  );
}

export default function AirfoilConnectionConfig() {
  const { model } = useWing();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Typography variant="h6" color="primary">翼型连接概览</Typography>
        <Chip label="只读" size="small" sx={{ color: 'design.slateDark', borderColor: 'design.slateDark', fontSize: 10, height: 20 }} variant="outlined" />
      </Box>
      <Typography variant="caption" sx={{ color: 'design.slateDark', display: 'block' }}>
        展示根翼型 → 尖翼型之间的几何连接状态。修改参数请前往「翼根配置」「翼尖配置」「双翼排布」。
      </Typography>

      {/* 根部翼型 */}
      <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'design.skyBg', border: '1px solid design.skyBorder' }}>
        <Typography variant="subtitle2" sx={{ color: 'design.sky', mb: 1, fontWeight: 'bold' }}>根部翼型 (Root)</Typography>
        <InfoRow label="翼型文件" value={<Chip size="small" label={model.rootAirfoil} sx={{ bgcolor: 'rgba(56,189,248,0.15)', color: 'design.sky', fontSize: 11, height: 22 }} />} />
        <InfoRow label="端面弦长" value={`${model.rootChord} mm`} />
        <InfoRow label="厚度缩放" value={`${model.rootThickness}%`} />
        <InfoRow label="局部扭转" value={`${model.rootRotation}°`} />
      </Box>

      {/* 尖部翼型 */}
      <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'design.orangeBg', border: '1px solid design.orangeBorder' }}>
        <Typography variant="subtitle2" sx={{ color: 'design.orange', mb: 1, fontWeight: 'bold' }}>尖部翼型 (Tip)</Typography>
        <InfoRow label="翼型文件" value={<Chip size="small" label={model.tipAirfoil} sx={{ bgcolor: 'rgba(251,146,60,0.15)', color: 'design.orange', fontSize: 11, height: 22 }} />} />
        <InfoRow label="端面弦长" value={`${model.tipChord} mm`} />
        <InfoRow label="厚度缩放" value={`${model.tipThickness}%`} />
        <InfoRow label="局部扭转" value={`${model.tipRotation}°`} />
      </Box>

      {/* 偏移与排布 */}
      <Box sx={{ p: 2, borderRadius: 2, border: '1px dashed rgba(148, 163, 184, 0.3)', bgcolor: 'rgba(148, 163, 184, 0.04)' }}>
        <Typography variant="subtitle2" sx={{ color: 'design.slate', mb: 1, fontWeight: 'bold' }}>偏移与排布 (编辑入口：双翼排布)</Typography>
        <InfoRow label="翼根偏移" value={`X ${model.rootOffsetX || 0} / Y ${model.rootOffsetY || 0} mm`} />
        <InfoRow label="翼尖偏移" value={`X ${model.tipOffsetX || 0} / Y ${model.tipOffsetY || 0} mm`} />
        <InfoRow label="双翼间隙" value={`X ${model.interWingOffsetX || 0} / Y ${model.interWingOffsetY || 0} mm`} />
        <InfoRow label="堆叠方向" value={model.stackingMode === 'vertical' ? '纵向 (Y轴)' : '横向 (X轴)'} />
      </Box>

      <Divider sx={{ opacity: 0.1 }} />

      <Typography variant="caption" sx={{ color: 'design.slateDark', display: 'block', lineHeight: 1.7 }}>
        * 翼根与翼尖翼型之间按弦长线性插值生成中间截面；
        * 厚度缩放与局部扭转作用于端面，中间截面平滑过渡；
        * 偏移影响翼型相对机床坐标原点的放置位置。
      </Typography>
    </Box>
  );
}