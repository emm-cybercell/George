import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";
import "./index.scss";

interface PageHeaderProps {
  title: string;
}

const CustomPageHeader = ({ title }: PageHeaderProps) => {
  const goBack = () => {
    Taro.navigateBack();
  };

  return (
    <View className="page-header">
      <View className="page-header__back" onClick={goBack}>
        ‹
      </View>
      <Text className="page-header__title">{title}</Text>
    </View>
  );
};

export default CustomPageHeader;
