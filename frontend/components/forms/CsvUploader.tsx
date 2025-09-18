import React from 'react'
import Pipeline from '../pipeline/Pipeline'

interface CsvUploaderProps {
    onUploadComplete?: (result: any) => void
}

export default function CsvUploader({ onUploadComplete }: CsvUploaderProps) {
    return <Pipeline />
}