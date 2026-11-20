import { ScrollViewStyleReset, useServerDocumentContext } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function RootHtml({ children }: PropsWithChildren) {
  const { headNodes, bodyNodes, htmlAttributes, bodyAttributes } = useServerDocumentContext();
  return (
    <html {...htmlAttributes} lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Gowun+Dodum&display=swap" rel="stylesheet" />
        <style>{`
          body,
          body [dir="auto"],
          body input,
          body textarea,
          body button {
            font-family: "Gowun Dodum", sans-serif !important;
          }
        `}</style>
        <ScrollViewStyleReset />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
