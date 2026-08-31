import { PropsWithChildren, useEffect } from "react";
import Taro from "@tarojs/taro";

import "./app.scss";

const CLOUD_ENV = "cloud1-d3g4mujv731fe8756";

function App({ children }: PropsWithChildren) {
  useEffect(() => {
    if (process.env.TARO_ENV === "weapp") {
      if (!Taro.cloud) {
        console.error("请使用 2.2.3 或以上的基础库以使用云能力");
      } else {
        Taro.cloud.init({
          env: CLOUD_ENV,
          traceUser: true,
        });
      }
    }
  }, []);

  // children 是将要会渲染的页面
  return children;
}

export default App;
