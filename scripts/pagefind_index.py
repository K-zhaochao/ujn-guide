"""
构建后处理：对生成的静态站点运行 Pagefind 索引

Pagefind 是一个静态搜索引擎，它在构建时生成索引，
提供比 lunr.js 更好的中文搜索支持（无须 jieba 分词预处理）。

用法：mkdocs build && python scripts/pagefind_index.py

设计原则：
  1. 使用 npx pagefind 生成搜索引擎索引
  2. 索引文件输出到 site/pagefind/ 目录
  3. 无需任何外部搜索引擎服务（纯静态方案）
"""
import os
import subprocess
import sys
from pathlib import Path


def main():
    site_dir = Path(__file__).parent.parent / "site"

    if not site_dir.exists():
        print("[!] 找不到 %s，请先运行 mkdocs build" % site_dir)
        sys.exit(1)

    # 检查 site 目录下是否有 index.html（有效站点）
    if not (site_dir / "index.html").exists():
        print("[!] %s 中没有 index.html，请先运行 mkdocs build" % site_dir)
        sys.exit(1)

    print("[*] 运行 Pagefind 索引（来源: %s）..." % site_dir)

    result = subprocess.run(
        ["npx", "pagefind", "--site", str(site_dir)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        cwd=site_dir.parent,
        shell=True,
    )

    # 打印输出
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        # 过滤掉与编码错误相关的行
        for line in result.stderr.splitlines():
            if "Unicode" not in line and "gbk" not in line.lower():
                print(line)

    if result.returncode != 0:
        print("[!] Pagefind 索引失败（exit code: %d）" % result.returncode)
        sys.exit(1)

    # 验证索引生成
    pagefind_dir = site_dir / "pagefind"
    if pagefind_dir.exists():
        # 计算索引文件大小
        total_size = sum(
            f.stat().st_size for f in pagefind_dir.rglob("*") if f.is_file()
        )
        file_count = len(list(pagefind_dir.rglob("*")))
        print("[+] Pagefind 索引完成！")
        print("   索引目录: %s" % pagefind_dir)
        print("   文件数量: %d" % file_count)
        print("   索引大小: %.1f KB" % (total_size / 1024))
    else:
        print("[?] Pagefind 运行完毕，但未找到 %s" % pagefind_dir)
        print("   请检查 Pagefind 输出")


if __name__ == "__main__":
    main()
