import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";

async function testPDFLoader() {
  try {
    console.log("PDFLoader初期化を開始します...");
    const pdfLoader = new PDFLoader("src/example_data/250703_jtb_summer_vacation_report.pdf");
    console.log("PDFLoaderが正常に初期化されました");
    
    console.log("PDFファイルの読み込みを開始します...");
    const data = await pdfLoader.load();
    console.log("PDFファイルの読み込みが完了しました");
    console.log(`ドキュメント数: ${data.length}`);
    
  } catch (error) {
    console.error("エラーが発生しました:", error);
  }
}

testPDFLoader();