import ffmpeg from "fluent-ffmpeg";
import sharp from "sharp";
import LoggingService from "./logService";

process.on(
  "message",
  async (payload: {
    file: Express.Multer.File;
    compressType: string;
    compressSize: string;
  }) => {
    const endProcess = ({ startTime, ...endPayload }) => {
      console.log(
        `🚀 ~ Worker ${process.pid} finished compressing in ${performance.now() - startTime
        }ms`
      );
      // Format response so it fits the api response
      process.send(endPayload);
      // End process
      process.exit();
    },
      qualityFn = (compressSize: string) => {
        switch (compressSize) {
          case "tablet":
            return 50;
          case "mobile":
            return 10;
          case "preload":
            return 1;
          default:
            return 90;
        }
      },
      { compressType, file, compressSize } = payload,
      quality = qualityFn(compressSize),
      filename = file.filename.split("."),
      extension = file.originalname.split(".").pop(), // Get the extension from the file path
      startTime = performance.now();
    console.log(
      `🚀 ~ Worker ${process.pid} is compressing ${file.filename} to ${compressSize} quality`
    );

    try {
      let compressedFilePath = "";
      switch (compressType) {
        case "IMAGE":
          // Process image
          compressedFilePath = `${file.destination}/${filename[0]}_${compressSize}.webp`;

          await sharp(file.path)
            .toFormat("webp")
            .webp({ quality })
            .resize(compressSize == "preload" ? 20 : null)
            .toFile(compressedFilePath);

          return endProcess({
            startTime,
            statusCode: 200,
            text: "Upload và tối ưu thành công hình ảnh",
            path: {
              [compressSize]: `/images/${filename[0]}_${compressSize}.webp`,
            },
          });
        case "VIDEO":
          // Process video and send back the result
          compressedFilePath = `${file.destination}/${filename[0]}_${compressSize}.${extension}`;
          await new Promise((resolve, reject) =>
            ffmpeg(file.path)
              .size(`${quality}%`)
              .outputOptions([
                "-c:v libx264",
                `-b:v ${1000}k`,
                "-c:a aac",
                "-b:a 58k",
                "-crf 28",
              ])
              .on("end", resolve)
              // .on('progress', function (progress) {
              //     console.log('Processing: ' + progress.percent + '% done');
              // })
              .on("error", (err) => reject(new Error(err.message)))
              .save(compressedFilePath)
          );

          return endProcess({
            startTime,
            statusCode: 200,
            text: "Upload và tối ưu thành công video",
            path: {
              [compressSize]: `/videos/${filename[0]}_${compressSize}.${extension}`,
            },
          });
        default:
          return endProcess({
            startTime,
            statusCode: 204,
            text: "File không thuộc danh sách cần nén",
            path: { original: "/" + file.filename },
          });
      }
    } catch (error) {
      await new LoggingService().logErrorAsync("compressFileService", error, null)
      return endProcess({
        statusCode: 500,
        text: error.message,
        startTime: "",
      });
    }
  }
);
