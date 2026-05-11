// src/types/wing.model.ts

export interface WingModel {
  /** 翼根厚度 */
  rootThickness: number;
  /** 翼尖厚度 */
  tipThickness: number;
    // ========== 切割设置参数 ==========
  // ========== 基本信息 ==========
  modelName: string;                    // 模型名称，用于文件名
  wingSpan: number;                     // 翼展（半展长 × 2）
  rootChord: number;                // 根弦长
  rootRotation: number;                
  tipChord: number;     
  tipRotation:   number;                // 尖弦长
  washout: number;                      // 扭角（度），负值表示鼻下

  // ========== 翼型文件 ==========
  rootAirfoil: string;                  // 根部翼型文件名，如 "naca2412.dat"
  tipAirfoil: string;                   // 尖部翼型文件名

  // ========== 泡沫与加工 ==========
  foamChord: number;                    // 泡沫块弦向长度（必须 ≥ 根弦 + 浪费量）
  foamThickness: number;    
  foamLength:number;            // 泡沫块厚度（决定能否切 BOTH
  trailingEdgeLimit: number;            // 尾缘最小厚度（mm），用于过切补偿
  leadingEdgeSweep: number;             // 前缘后掠量（mm），原 Python 叫 sweep

  // ========== 机床设置 ==========
  feedrate: number;                     // 进给速度 F 值
  gantryDistance: number;               // 龙门架两热丝间距（关键！原 Python 的 carriage）
  xySide: 'left' | 'right';             // XY 在左还是右（决定左右翼谁切谁）
  /** 机床轴映射模式，如 ['x','y','u','z']，分别对应第1~4轴 */
  xyuvMode: [string, string, string, string];
  // 机台尺寸（单位 mm）
  machineWidth: number;                 // 机台有效宽度（X方向）
  machineLength: number;                // 机台有效长度（Y方向）
  machineHeight: number;                // 机台有效高度（Z方向），不含离地高度
  groundClearance: number;              // 机台离地高度（机台底部到地面）

  /** 泡沫块整体旋转（度），正值为逆时针，负值为顺时针。默认 -90（顺时针90°） */
  foamRotation: number;

  /** 当前预览的 G-code 字符串组 */
  previewGcodeData?: {
    left: string;
    right: string;
    both: string;
    warnings: string[];
  };

  /** 泡沫块 Z 方向偏移 (mm)，从龙门架 Z=0 起算 */
  foamOffsetZ: number;

  /** 翻转翼面 Z 轴方向（针对左右翼镜像） */
  flipZ?: boolean;
  /** 机翼在平面上左右镜像 (X/U 轴) */
  mirrorX?: boolean;
  /** 机翼在平面上上下镜像 (Y/Z 轴) */
  mirrorY?: boolean;

  // ========== 单位与显示 ==========
  unit: 'mm' | 'inch';


  /** 是否启用尾缘过切（true=自动把尾缘压到 trailingEdgeLimit） */
  limitTrailingEdge: boolean;

  /** 是否生成 BOTH 文件（双面一次切完） */
  generateBoth: boolean;
  /** 是否在 BOTH 模式下启用嵌套（反转第二只机翼 180 度） */
  nestBoth: boolean;
  /** 双翼堆叠模式：horizontal（左右）或 vertical（上下） */
  stackingMode: 'horizontal' | 'vertical';

  /** 是否启用根部/尖部额外偏移（高级用户用） */
  rootOffsetX: number;     // 根部 X 方向额外偏移
  rootOffsetY: number;     // 根部 Y 方向额外偏移
  tipOffsetX: number;      // 尖部 X 方向额外偏移
  tipOffsetY: number;      // 尖部 Y 方向额外偏移
  /** 生成 BOTH 时两个翼型的相对位移（mm） */
  interWingOffsetX: number;
  interWingOffsetY: number;

  /** 翼型安全距离（mm），控制切割路径离开坐标原点的最小距离 */
  pathMargin: number;

  /** 切割顺序：0=先上表面后下表面，1=先下后上（影响排线） */
  cutDirection: 0 | 1;

  /** 安全高度（mm），快速移动时的 Z/U 高度，防止撞泡沫 */
  safeHeight: number;
}

// 默认值（直接复制粘贴就行）
export const defaultModel: WingModel = {
  rootThickness: 100,
  tipThickness: 100,
  modelName: 'DefaultWing',
  wingSpan: 500,    
  rootChord: 220,
  rootRotation: 0,
  tipChord: 200,
  tipRotation: 0,
  foamRotation: 0,
  rootAirfoil: 'E334.DAT',
  tipAirfoil: 'E334.DAT',
  washout: 0,
  foamChord: 500,
  foamLength:250,
  foamThickness: 60,
  trailingEdgeLimit: 3,
  leadingEdgeSweep: 20,
  feedrate: 200,
  gantryDistance: 1200,         // 必须加！原 Python 的 carriage
  xySide: 'right',
  xyuvMode: ['X', 'Y', 'U', 'Z'],
  unit: 'mm',

  // 机台尺寸默认（根据你给出的 "70705014" 默认序列，这里按 70,70,50,14 扩展为毫米级 *10 -> 700,700,500,140；
  // 如果你希望别的默认值，请告诉我。）
  machineWidth: 700,
  machineLength: 1000,
  machineHeight: 500,
  groundClearance: 140,

  limitTrailingEdge: true,
  generateBoth: true,
  nestBoth: true,
  stackingMode: 'vertical',
  rootOffsetX: 0,
  rootOffsetY: 0,
  tipOffsetX: 0,
  tipOffsetY: 0,
  interWingOffsetX: 0,
  interWingOffsetY: 30,
  pathMargin: 10,
  cutDirection: 0,
  safeHeight: 50,
  foamOffsetZ: 0, // 默认起点位于坐标系 0 点
  flipZ: false,
  mirrorX: false,
  mirrorY: false,
};