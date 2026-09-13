import { useLayoutEffect } from "react";
import { PRODUCT_NAME } from "./copy";

export function usePageTitle(title: string): void {
  useLayoutEffect(() => {
    document.title = title;
    return () => {
      document.title = PRODUCT_NAME;
    };
  }, [title]);
}
