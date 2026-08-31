export default defineAppConfig({
  pages: [
    "pages/home/index",
    "pages/learn/index",
    "pages/profile/index",
    "pages/history/index",
    "pages/about/index",
    "pages/team/index",
    "pages/feature-detail/index",
    "pages/ability-setting/index",
  ],
  plugins: {
    WechatSI: {
      version: "0.3.10",
      provider: "wx069ba97219f66d99",
    },
  },
  permission: {
    "scope.record": {
      desc: "用于语音转文字功能",
    },
  },
  window: {
    backgroundTextStyle: "light",
    navigationBarBackgroundColor: "#8B5CF6",
    navigationBarTitleText: "桥智同学",
    navigationBarTextStyle: "white",
    navigationStyle: "custom",
  },
});
