# RhythMC 材质包制作工具

一个基于网页的 RhythMC 材质包制作工具，帮助玩家快速创建和定制游戏材质包。

## 功能特性

- 音频处理功能（支持格式转换等）
- 一键打包生成材质包文件

## 技术栈

- 前端框架: 原生 HTML + Vite + TypeScript
- 样式: LESS 预处理器
- 音频处理: FFmpeg
- 文件打包: JSZip

## 开发说明

1. 确保安装 Node.js 16+
2. 安装依赖: `npm install`
3. 启动开发服务器: `npm run dev`
4. 访问 `http://localhost:3000`

## 构建说明

1. 确保安装 Node.js 16+
2. 安装依赖: `npm install`
3. 运行 `npm run buld`
4. 构建产物位于 `dist` 目录下

## 注意事项

- 部分音频处理功能需要浏览器支持 WebAssembly
- 生成的材质包需手动使用`结果代码`发送到服务端进行导入
