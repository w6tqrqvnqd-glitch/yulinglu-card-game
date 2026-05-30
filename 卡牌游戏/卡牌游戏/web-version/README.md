# 网页版卡牌游戏

这是您原来桌面卡牌游戏的网页版本，现在可以在浏览器中游玩！

## 特性

- 与原版游戏相同的卡牌对战机制
- 网页端优化的用户界面
- 响应式设计，支持桌面和移动设备
- 保留所有原版游戏功能：
  - 出牌阶段和攻击阶段
  - 随从互伤机制
  - 英雄攻击
  - 法力值系统
  - 战场容量限制

## 运行方式

### 方法1：使用Python内置服务器（推荐）

1. 打开命令提示符并导航到项目目录：
```bash
cd d:/Desktop/卡牌游戏/web-version
```

2. 启动服务器：
```bash
python server.py
```

3. 游戏将在浏览器中自动打开，访问地址：http://localhost:8000/web-version/

### 方法2：直接打开HTML文件

1. 直接双击 `index.html` 文件
2. 注意：某些浏览器功能可能在直接打开文件时受限，推荐使用方法1

### 方法3：使用Live Server扩展（如果您使用VSCode）

1. 在VSCode中打开web-version目录
2. 安装Live Server扩展
3. 右键点击index.html，选择"Open with Live Server"

## 游戏操作

- **出牌阶段**：点击或拖拽手牌到战场
- **攻击阶段**：点击己方随从，再点击敌方目标
- **切换阶段**：按空格键
- **结束回合**：按空格键（在攻击阶段）

## 开发

网页版游戏使用纯HTML、CSS和JavaScript开发，无需额外依赖：

- `index.html` - 主页面结构
- `css/style.css` - 样式文件
- `js/game.js` - 游戏主逻辑
- `js/cards.js` - 卡片系统
- `js/ui.js` - 用户界面逻辑

## 自定义

您可以轻松定制游戏：

1. 修改卡片数据：编辑 `js/cards.js` 中的卡片定义
2. 调整游戏平衡：修改 `js/game.js` 中的数值
3. 更换美术资源：替换 `images/` 目录下的图像文件

## 兼容性

游戏支持所有现代浏览器：
- Chrome
- Firefox
- Safari
- Edge

## 部署

您可以将整个 `web-version` 目录部署到任何支持静态文件托管的服务：
- GitHub Pages
- Netlify
- Vercel
- 传统Web服务器