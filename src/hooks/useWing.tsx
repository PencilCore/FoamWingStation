
import React, { useContext, useCallback } from 'react';
import type { WingModel } from '../types/wing.model';
import { defaultModel } from '../types/wing.model';

// --- Context 定义 ---
const WingContext = React.createContext<
    {
        model: WingModel;
        setModel: React.Dispatch<React.SetStateAction<WingModel>>;
        handleModelChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
        handleRadioChange: (name: keyof WingModel, value: any) => void;
    } | undefined
>(undefined);

// --- Provider 组件 ---
const STORAGE_KEY = 'foam-wing-station-design';

export const WingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [model, setModel] = React.useState<WingModel>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                return { ...defaultModel, ...JSON.parse(saved) };
            } catch (e) {
                console.error('Failed to parse saved model', e);
            }
        }
        return defaultModel;
    });

    // 自动保存到 localStorage
    React.useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
    }, [model]);

    /**
     * @description 统一处理所有 TextField 输入（包括数字和文本）
     * 依赖 HTML Input 的 type 属性来决定是否转为 Number。
     */
    const handleModelChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        
        // 核心逻辑：如果是 type="number" 且值非空，则转换为 Number
        let newValue: string | number;
        if (type === 'number') {
             // 如果值是空字符串，保持空字符串或转换为 0，这里选择 Number(value) 
             // 因为 MUI/React 会将 input value 视作字符串
             // 更好的做法是：空字符串存为 null/undefined，但为了避免修改 WingModel 接口，我们简单地处理
             newValue = value === '' ? '' : Number(value); 
        } else {
             newValue = value;
        }

        setModel(prev => ({ ...prev, [name]: newValue }));
    }, []);

    /**
     * @description 专用于处理 Radios 或非事件驱动的 Select（例如 MUI 的 Select 组件，如果不用 SelectProps={{ native: true }}）
     * 接收字段名和新的值，通常用于枚举类型（如 unit, xySide, xyuvMode）和数字值（如 cutDirection）。
     */
    const handleRadioChange = useCallback((name: keyof WingModel, value: string | boolean | number) => {
        // 由于 xySide, xyuvMode, unit 都是字符串/枚举类型，cutDirection 是数字
        // 假设传入的值已经是正确的类型，这里直接赋值
        setModel(prev => ({ ...prev, [name]: value as any }));
    }, []);

    const value = {
        model,
        setModel,
        handleModelChange,
        handleRadioChange
    };

    return <WingContext.Provider value={value}>{children}</WingContext.Provider>;
};

// --- Hook 导出 ---
export const useWing = () => {
    const context = useContext(WingContext);
    if (!context) {
        throw new Error('useWing 必须在 <WingProvider> 内部使用！检查你的 App.tsx 或 main.tsx');
    }
    return context;
};