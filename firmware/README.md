# GRBL 四轴固件 - Foam Wing Station

这是针对 **泡沫翼机热丝切割机** 优化的 **GRBL-UNO 4 轴控制固件**。

## 📋 特性

- **4 轴联动**：X、Y、U（第二工作台横向）、Z（高度）
- **Arduino UNO/Mega 兼容**：基于经典 GRBL 魔改
- **热丝切割优化**：支持多塔联动、精准同步控制
- **开源社区**：完全透明的硬件加工链路

---

## 🔧 快速开始

### 第一步：安装 Arduino IDE

1. 下载 [Arduino IDE (1.8.x 或 2.x)](https://www.arduino.cc/en/software)
2. 安装完成后打开

### 第二步：导入 GRBL 库

#### 方案 A：自动导入（推荐）
```
Sketch > Include Library > Add .ZIP Library
```
然后选择 `foam-wing-station/firmware` 文件夹，Arduino IDE 会自动识别并导入。

#### 方案 B：手动复制（备选）
1. 找到你的 Arduino 库目录：
   - **Windows**：`C:\Users\[你的用户名]\Documents\Arduino\libraries\`
   - **macOS**：`~/Documents/Arduino/libraries/`
   - **Linux**：`~/Arduino/libraries/`
2. 在其中新建 `grbl-uno-4axes` 文件夹
3. 将本 `firmware/` 下的所有 `.c`、`.h` 文件复制进去

### 第三步：编译并上传

1. **打开示例代码**
   ```
   File > Examples > grbl-uno-4axes > grblUpload
   ```

2. **选择开发板**
   ```
   Tools > Board > Arduino AVR Boards > Arduino Uno
   ```
   （如果使用 Mega，则选 `Arduino Mega 2560`）

3. **选择串口**
   ```
   Tools > Port > COM3 (或你的 Arduino 串口)
   ```
   > ⚠️ 不确定串口？在 Windows 设备管理器中查看"端口"，或 macOS 运行 `ls /dev/tty.*`

4. **编译并上传**
   ```
   Sketch > Upload (Ctrl+U)
   ```
   IDE 会自动编译并刷入 Arduino。编译大约需要 30-60 秒。

### 第四步：验证刷写成功

1. 打开 Arduino IDE 的 **Serial Monitor**（右上角或 `Tools > Serial Monitor`）
2. 波特率设置为 **9600**
3. 如果看到类似输出，说明固件已成功启动：
   ```
   [MSG: Grbl 1.1f]
   [MSG: 4-Axis Enabled]
   [MSG: XYUV Configuration]
   ```

4. 输入 `?` 并按 Enter，应能看到当前轴位置（形如 `<Idle|MPos:0.000,0.000,0.000,0.000>`）

---

## ⚙️ 关键配置

### 引脚映射（`cpu_map.h`）

编辑 `firmware/cpu_map.h` 可修改硬件引脚分配：

```c
// X 轴步进脚（Step Pin）
#define X_STEP_BIT    2    // Pin D2
#define X_DIRECTION_BIT  5  // Pin D5

// U 轴（第二工作台）
#define U_STEP_BIT    6    // Pin D6  
#define U_DIRECTION_BIT  7  // Pin D7

// 依此类推 Y、Z 轴...
```

修改后重新编译上传即可。

### 默认参数（`defaults.h`）

关键参数设置：

```c
#define DEFAULT_X_STEPS_PER_MM 80.0        // 你的 X 轴丝杆螺距
#define DEFAULT_Y_STEPS_PER_MM 80.0
#define DEFAULT_U_STEPS_PER_MM 80.0        // 第二工作台
#define DEFAULT_Z_STEPS_PER_MM 800.0       // 通常更大

#define DEFAULT_X_MAX_RATE 1000.0          // mm/min（快速定位速度）
#define DEFAULT_CUTTING_RATE 500.0         // mm/min（切割速度，应更慢）
```

---

## 🔌 硬件接线

### Arduino UNO 到步进电机驱动模块（以 DRV8825 或 A4988 为例）

| Arduino 引脚 | 模块信号 | 对应轴 | 说明 |
|---|---|---|---|
| D2 | STEP | X | X 轴脉冲 |
| D5 | DIR | X | X 轴方向 |
| D3 | STEP | Y | Y 轴脉冲 |
| D6 | DIR | Y | Y 轴方向 |
| D4 | STEP | U | U 轴脉冲（第二工作台）|
| D7 | DIR | U | U 轴方向 |
| D8 | STEP | Z | Z 轴脉冲（高度）|
| D9 | DIR | Z | Z 轴方向 |
| D10 | ENABLE | 全轴 | 使能（低电平时电机工作）|
| GND | GND | - | 地线（重要！） |

**电源部分：**
- 步进电机电源（12V 或 24V）连接到 DRV8825 的 +12V/GND
- Arduino 通过 USB 供电，或额外的 5V 电源

---

## 📡 通过串口发送 G-Code

### 使用 Foam Wing Station 前端

在设计完成后，点击"切割"选项卡 → 生成 G-Code → "发送到设备"。

### 手动测试（Serial Monitor）

在 Arduino IDE Serial Monitor 中输入以下命令：

```gcode
; 回零（硬限位）
$H

; 查询当前位置
?

; 快速定位到 X=100, Y=50
G0 X100 Y50

; 低速切割（设置进给速度为 300mm/min）
G1 F300 X100 Y100

; 紧急停止
!
```

---

## 🐛 常见问题

### Q1: 上传时出现 "Board at COM3 is not available" 或类似错误

**解决方案：**
1. 确保 Arduino 已用 USB 线连接到电脑
2. 驱动程序：Windows 用户通常需要安装 **CH340 USB 驱动**（如使用第三方 Arduino 板）
3. 尝试更换 USB 线（有些线只能充电，不能通信）
4. 重启 Arduino IDE

### Q2: Serial Monitor 显示乱码

**解决方案：**
- 检查波特率是否为 **9600**（不是 115200 或其他）
- 重新打开 Serial Monitor

### Q3: 电机不转或转向错误

**解决方案：**
1. 检查接线（STEP、DIR、ENABLE 引脚是否正确）
2. 在 `defaults.h` 中反转轴的步进方向：
   ```c
   #define INVERT_X_AXIS 1  // 改为 0 或 1 来反转
   ```
3. 重新编译上传

### Q4: "Compile error: 'some_function' was not declared"

**解决方案：**
- 确保 GRBL 库正确导入
- 尝试 `Sketch > Verify/Compile` 单独编译（不上传）
- 清除 Arduino IDE 缓存：`File > Preferences > Use external editor`（打勾），重启 IDE

---

## 📚 进阶配置

### 修改最大进给速度

在 `defaults.h` 修改：
```c
#define DEFAULT_X_MAX_RATE 1500.0  // 从 1000 改为 1500 mm/min
```

### 启用/禁用硬限位开关

在 `config.h` 查找 `ENABLE_HARD_LIMITS` 并修改：
```c
#define ENABLE_HARD_LIMITS 1  // 1 = 启用，0 = 禁用
```

### 调整脉冲宽度（微步细分）

步进电机驱动模块上通常有 MS（Microstepping）引脚，可以通过跳线帽设置细分数：
- 无跳线：全步（Full Step）
- 1 个跳线：1/2 微步
- 2 个跳线：1/4 微步（推荐）
- 3 个跳线：1/8 或 1/16 微步（精度高但功耗大）

对应地在 `defaults.h` 中调整 `STEPS_PER_MM`。

---

## 🔗 相关资源

- [GRBL 官方文档](https://github.com/gnea/grbl)
- [Arduino 官方教程](https://www.arduino.cc/en/Guide/ArduinoUno)
- [DRV8825 驱动模块说明](https://www.pololu.com/product/2133)
- [Foam Wing Station 前端项目](https://github.com/你的账号/foam-wing-station)

---

## 📝 许可证

本固件基于 **GRBL** 开源项目，继承其 **GPLv3** 许可证。
详见本文件夹中的 `LICENSE` 文件。

**最后更新**：2026 年 3 月 12 日
